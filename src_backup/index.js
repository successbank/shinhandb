const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 ${process.env.PROJECT_NAME} 프로젝트</h1>
    <p>Node.js 서버가 성공적으로 실행되었습니다!</p>
    <p>환경: ${process.env.NODE_ENV}</p>
    <p>포트: ${port}</p>
  `);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});
