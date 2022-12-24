const fs    = require('node:fs').promises;
const https = require('node:https');

const userName     = process.env.REDDIT_USER_NAME    ;
const password     = process.env.REDDIT_PASSWORD     ;
const clientId     = process.env.REDDIT_CLIENT_ID    ;
const clientSecret = process.env.REDDIT_CLIENT_SECRET;

/**
 * HTTPS Request
 * 
 * @param {string} url URL
 * @param {object} options Options
 * @param {string | undefined} body Request Body
 * @return {Promise<string>} Response
 */
const request = (url, options = {}, body = undefined) => new Promise((resolve, reject) => {
  const req = https.request(url, options, res => {
    let data = '';
    res.setEncoding('utf8')
       .on('data', chunk => data += chunk)
       .on('end' , ()    => resolve(data));
  }).setTimeout(5000)
    .on('error'  , error => reject(error))
    .on('timeout', ()    => { req.destroy(); reject('Request Timeout'); });
  if(body) req.write(body);
  req.end();
});

/**
 * Fetch Access Token
 * 
 * @return {Promise<string>} Access Token
 */
const fetchAccessToken = async () => {
  const rawResponse = await request('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'User-Agent' : 'Neos21 Bot',
      Authorization: `Basic ${Buffer.from(clientId + ':' + clientSecret).toString('base64')}`
    }
  }, `grant_type=password&username=${userName}&password=${password}`);
  console.log(rawResponse);
  const response = JSON.parse(rawResponse);
  const accessToken = response.access_token;
  console.log(`Access Token : [${accessToken}]`);
  return accessToken;
};

// Main
(async () => {
  try {
    if([userName, password, clientId, clientSecret].includes(undefined)) throw new Error('Invalid Environment Variables');
    
    const accessToken = await fetchAccessToken();
    
    let allSubreddits = [];
    let after         = null;
    do {
      const url = `https://oauth.reddit.com/subreddits/mine/subscriber?limit=100${after == null ? '' : '&after=' + after}`;
      console.log(`  ${url}`);
      const rawResponse = await request(url, {
        headers: {
          'User-Agent' : 'Neos21 Bot',
          Authorization: `Bearer ${accessToken}`
        }
      });
      const response = JSON.parse(rawResponse);
      const currentSubreddits = response.data.children;
      allSubreddits.push(...currentSubreddits);
      after = response.data.after;
      console.log(`    Current Subreddits : [${currentSubreddits.length}] , All Subreddits [${allSubreddits.length}] , After [${after}]`);
    } while(after != null);
    console.log(`All Subreddits : [${allSubreddits.length}]`);
    
    const subreddits = allSubreddits
      .map(subreddit => ({
        url        : `https://www.reddit.com${subreddit.data.url}`,
        title      : subreddit.data.title,
        subscribers: subreddit.data.subscribers
      }))
      .map(subreddit => `${subreddit.url}\t${subreddit.subscribers}\t${subreddit.title}`)
      .sort()
      .join('\n');
    await fs.writeFile('./subreddits.tsv', `URL	Subscribers	Title\n${subreddits}\n`, 'utf-8');
    
    console.log('Succeeded');
  }
  catch(error) {
    console.error('Error', error);
  }
})();
