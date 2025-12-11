const express = require('express');
const app = express();

app.get('/api/mock/prs', (req, res) => {
  res.json([
    {
      prNumber: '101',
      author: 'alice',
      riskScore: 0.12,
      decision: 'ALLOW',
      summary: 'Small docs change',
      suggestedTests: ['Verify no behavior change']
    },
    {
      prNumber: '102',
      author: 'bob',
      riskScore: 0.78,
      decision: 'BLOCK',
      summary: 'Adds Runtime.exec usage',
      suggestedTests: ['Manual security review', 'Add unit tests']
    }
  ]);
});

const port = 3000;
app.listen(port, ()=>console.log('Mock API for dashboard running on', port));
