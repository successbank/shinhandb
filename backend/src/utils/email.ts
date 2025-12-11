import nodemailer from 'nodemailer';

/**
 * 이메일 발송 유틸리티
 * - Nodemailer를 사용한 SMTP 이메일 발송
 * - 개발 환경에서는 Ethereal Email (테스트용 SMTP) 사용 가능
 */

// SMTP 설정 (환경 변수에서 가져오기)
const SMTP_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.EMAIL_PORT || '587');
const SMTP_USER = process.env.EMAIL_USER || '';
const SMTP_PASS = process.env.EMAIL_PASSWORD || '';
const SMTP_FROM = process.env.EMAIL_FROM || '신한금융 광고관리 플랫폼 <noreply@shinhan.com>';

// Nodemailer transporter 생성
let transporter: nodemailer.Transporter | null = null;

/**
 * Transporter 초기화
 */
const getTransporter = async (): Promise<nodemailer.Transporter> => {
  if (transporter) {
    return transporter;
  }

  // 프로덕션 환경
  if (SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    console.log('[Email] SMTP transporter initialized (production mode)');
  } else {
    // 개발 환경 - Ethereal Email 사용
    console.log('[Email] SMTP credentials not found, using test account...');
    const testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log('[Email] Ethereal test account created:', testAccount.user);
    console.log('[Email] Preview emails at: https://ethereal.email');
  }

  return transporter;
};

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * 이메일 발송
 */
export const sendEmail = async ({ to, subject, html, text }: SendEmailParams): Promise<boolean> => {
  try {
    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // HTML 태그 제거한 텍스트
    });

    console.log('[Email] Message sent:', info.messageId);

    // Ethereal 테스트 계정 사용 시 미리보기 URL 출력
    if (!SMTP_USER || !SMTP_PASS) {
      console.log('[Email] Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return true;
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    return false;
  }
};

/**
 * 신규 회원 가입 환영 이메일 (초기 비밀번호 포함)
 */
export const sendWelcomeEmail = async (
  to: string,
  name: string,
  email: string,
  password: string,
  role: string
): Promise<boolean> => {
  const roleNames: Record<string, string> = {
    ADMIN: '최고관리자',
    HOLDING: '신한금융지주 회원',
    BANK: '신한은행 회원',
    CLIENT: '클라이언트',
  };

  const subject = '[신한금융 광고관리 플랫폼] 계정이 생성되었습니다';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0046FF; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f5f5f5; padding: 30px; margin-top: 20px; border-radius: 5px; }
        .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #0046FF; }
        .password { font-size: 18px; font-weight: bold; color: #0046FF; letter-spacing: 1px; }
        .warning { background-color: #fff3cd; border-left-color: #ffc107; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #0046FF; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>신한금융 광고관리 플랫폼</h1>
        </div>

        <div class="content">
          <h2>안녕하세요, ${name}님!</h2>
          <p>신한금융 광고관리 플랫폼에 오신 것을 환영합니다.</p>
          <p>관리자가 귀하의 계정을 생성하였습니다. 아래의 로그인 정보를 확인해 주세요.</p>

          <div class="info-box">
            <p><strong>이메일:</strong> ${email}</p>
            <p><strong>임시 비밀번호:</strong> <span class="password">${password}</span></p>
            <p><strong>권한:</strong> ${roleNames[role] || role}</p>
          </div>

          <div class="warning">
            <strong>⚠️ 보안 안내</strong>
            <ul>
              <li>로그인 후 <strong>반드시 비밀번호를 변경</strong>해 주세요.</li>
              <li>비밀번호는 타인과 공유하지 마세요.</li>
              <li>이 이메일은 전달 후 삭제하시기 바랍니다.</li>
            </ul>
          </div>

          <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5647'}/login" class="button">
              로그인하기
            </a>
          </p>
        </div>

        <div class="footer">
          <p>본 메일은 발신 전용입니다. 문의사항은 시스템 관리자에게 연락해 주세요.</p>
          <p>&copy; 2025 신한금융그룹. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
};

/**
 * 비밀번호 재설정 이메일
 */
export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetToken: string
): Promise<boolean> => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5647'}/reset-password?token=${resetToken}`;

  const subject = '[신한금융 광고관리 플랫폼] 비밀번호 재설정 요청';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0046FF; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f5f5f5; padding: 30px; margin-top: 20px; border-radius: 5px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #0046FF; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .warning { background-color: #fff3cd; padding: 15px; margin: 15px 0; border-left: 4px solid #ffc107; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>비밀번호 재설정</h1>
        </div>

        <div class="content">
          <h2>안녕하세요, ${name}님!</h2>
          <p>비밀번호 재설정 요청을 받았습니다.</p>
          <p>아래 버튼을 클릭하여 비밀번호를 재설정하세요.</p>

          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">비밀번호 재설정</a>
          </p>

          <div class="warning">
            <strong>⚠️ 주의사항</strong>
            <ul>
              <li>이 링크는 <strong>1시간 동안만 유효</strong>합니다.</li>
              <li>비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하세요.</li>
              <li>링크가 작동하지 않으면 관리자에게 문의하세요.</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>본 메일은 발신 전용입니다.</p>
          <p>&copy; 2025 신한금융그룹. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
};
