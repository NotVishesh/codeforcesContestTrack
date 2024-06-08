const CHECK_INTERVAL_HOURS = 12;
// console.log('Background script is running!');


function firstInstall() {
  console.log('First install detected.');
  fetch('http://localhost:3000/auth')
    .then(response => response.json())
    .then(data => {
      chrome.tabs.create({ url: data.url });
      
      // window.location.href = data.url;  // This line won't work in a background script
    })
    .catch(error => {
      console.error('Error:', error);
    });
}


chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== 'install') {
    console.log('This is not a first install.');
    return;
  }

  // Open a new tab to redirect the user to the authentication page
  // chrome.tabs.create({ url: 'http://localhost:3000/auth' });
  firstInstall(); // Call the function to open a new tab



  await chrome.alarms.create('checkCfContests', {
    periodInMinutes: 0.5  // corrected to match the interval in hours
  });

  // Optionally, you can check for new contests immediately after installation
  checkForNewContests();
});

const checkForNewContests = async () => {
  console.log('checkForNewContests called');
  try {
    const response = await fetch('http://localhost:3000/auth');
    const data = await response.json();
    console.log('Response:', response);
    console.log('Data:', data);
    // window.location.href = data.url;  // This line won't work in a background script
  } catch (error) {
    console.error('Error:', error);
  }
};

chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('Alarm triggered:', alarm.name);
  if (alarm.name === "checkCfContests") {
    console.log("Correct alarm triggered, checking for new contests...");
    checkForNewContests();
  } else {
    console.log('Other alarm triggered:', alarm.name);
  }
});
