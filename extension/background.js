

const CHECK_INTERVAL_HOURS = 12;
const CHECK_INTERVAL_MINUTES = CHECK_INTERVAL_HOURS * 60;  

function firstInstall() {
  fetch('https://codeforces-contest-tracker.vercel.app/auth')
    .then(response => response.json())
    .then(data => {
      chrome.tabs.create({ url: data.url });
    })
    .catch(error => {
      console.error('Error:', error);
    });
}

function saveRefreshToken(token) {
  chrome.storage.local.set({ CFrefreshToken: token } )
  
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  
  firstInstall();
 
  await chrome.alarms.create('checkCfContests', {
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });
  
});

chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cookie.name === 'refreshToken') {
    const token = changeInfo.cookie.value;
    saveRefreshToken(token);
  }
});

const checkForNewContests = async () => {
  const { CFrefreshToken } = await chrome.storage.local.get('CFrefreshToken');
  try {
    const response = await fetch('https://codeforces-contest-tracker.vercel.app/recheckContest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
    },
      body: JSON.stringify({ token: CFrefreshToken })
    });
    console.log(response);
    // Handle the fetched data here
  } catch (error) {
    console.error('Error:', error);
  }
};

chrome.alarms.onAlarm.addListener((alarm) => {
  
  if (alarm.name === "checkCfContests") {
    checkForNewContests();
  } 
});
