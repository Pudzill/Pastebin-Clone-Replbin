<h1 align="center">Pastebin-Clone-Replbin</h1>
<h3 align="center">Generic Pastebin website clone, but MY generic Pastebin website clone!</h3>
<p align="center">Main server file is <code>index.js</code>.</p>

<p align="center"><strong>Supports:</strong></p>
<ul align="center">
  <li>raw viewing at /raw</li>
  <li>encryption</li>
  <li>paste expiration after certain numbers of minutes</li>
  <li>moderator access at /moderator allowing you to manually delete pastes (password protected)</li>
  <li>everything is by default encrypted with a secret password you set</li>
  <li>moderator password and default encryption password has to be set manually as envs. (index.js, lines 2 and 3.)</li>
  <li>only allows requests from its own origin for better security. url has to be manually set on index.js line 4.</li>
  <li>rate limiting, by default only 10 pastes every 5 minutes. can be changed on index.js line 41.</li>
  <li><strong>by default every paste is checked against APIs that check for inappropriate words. this is to comply with replit.com rules as this is what this project was by default made for. to remove this, change the check at index.js line 123 to something unrelated.</strong></li>
</ul>

<p align="center">
  <a href="https://replit.com/@Pudzilla/Replbin-Pastebin-Clone#index.js">
    <img src="https://replit.com/badge/github/Pudzill/Pastebin-Clone-Replbin" alt="Run on Repl.it">
  </a>
</p>
