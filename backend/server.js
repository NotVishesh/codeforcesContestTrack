require("dotenv").config();
const { google } = require("googleapis");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const bodyParser = require('body-parser');


const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(bodyParser.json()); 

async function getContestList() {
  try {
    const response = await fetch("https://codeforces.com/api/contest.list");
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error("Error:", error);
  }
}

async function fetchEventsList(EventsListUrl, access_token) {
  try {
    const response = await fetch(EventsListUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    return data.items;
    // Handle the response data here
  } catch (error) {
    console.error("Fetch error:", error);
    // Handle errors here
  }
}

// Usage example




const calendarEventAdder = async (contest,token) => {
  const event = {
    summary: contest.name,
    description: `codeforces_contest_ID=${contest.id}`,
    start: {
      dateTime: new Date(contest.startTimeSeconds * 1000).toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: new Date(
        (contest.startTimeSeconds + contest.durationSeconds) * 1000
      ).toISOString(),
      timeZone: "UTC",
    },
  };

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&key=${process.env.API_KEY}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (response.ok) {
      console.log(`Event added: ${contest.name}`);
    } else {
      console.error("Error adding event:", response.statusText);
    }
  } catch (error) {
    console.error("Error adding event:", error);
  }
};



// Setup session middleware
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);
const redirect_url = "https://codeforces-contest-tracker.vercel.app/oauth2callback"
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  redirect_url
);

const scopes = [
  "https://www.googleapis.com/auth/calendar",
];

const state = crypto.randomBytes(32).toString("hex");
session.state = state;

app.get("/", (req, res) => {
  res.send("Welcome to Codeforces Contest Reminder, Please authenticate to start receiving reminders");

});

app.get("/auth", (req, res) => {
  req.session.state = state;

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    include_granted_scopes: true,
    state: state,
  })
  res.json({ url: authorizationUrl });
});

app.get("/oauth2callback", async (req, res) => {
  const stateInSession = session.state;
  const stateInQuery = req.query.state;

  if (session.state !== req.query.state) {
    res.status(400).send("Invalid state parameter");
    return;
  }
  
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // i have the token now.

    let eventList = [];

    const EventsListUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?key=${process.env.API_KEY}&q=codeforces_contest_ID`;

    

    const cfContestList = await getContestList();
    let UpcomingContest =[];
    for (let i = 0; i < 20; i++) {
      if (cfContestList[i].phase === "BEFORE") {
        UpcomingContest.push(cfContestList[i]);
      }
    }

    
   

    const eventItems = await fetchEventsList(EventsListUrl, tokens.access_token);



    for (let i = 0; i < UpcomingContest.length; i++) {
      let flag = 0;
      for (let j = 0; j < eventItems.length; j++) {
        if (eventItems[j].description === `codeforces_contest_ID=${UpcomingContest[i].id}`) {
          flag = 1;
          break;
        }
      }
      if (flag === 0) {
        await calendarEventAdder(UpcomingContest[i], tokens.access_token);
      }
    }

    res.cookie('refreshToken', tokens.refresh_token, { httpOnly: true });
    res.send("Authentication successful");
  } catch (error) {
    console.error("Error retrieving access token:", error);
    res.status(500).send("Authentication failed");
  }
});

app.post("/recheckContest", express.json(), async (req, res) => {
  const {token} =  req.body;
  const refrehtoken = decodeURIComponent(token)
  oauth2Client.setCredentials({
    refresh_token: refrehtoken
  });
  const newAccessToken = await oauth2Client.getAccessToken();
  const myAccessTokenVariable = newAccessToken.res.data.access_token;

  const EventsListUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?key=${process.env.API_KEY}&q=codeforces_contest_ID`;

  const cfContestList = await getContestList();
  let UpcomingContest =[];
  for (let i = 0; i < 20; i++) {
    if (cfContestList[i].phase === "BEFORE") {
      UpcomingContest.push(cfContestList[i]);
    }
  }

  const eventItems = await fetchEventsList(EventsListUrl, myAccessTokenVariable);



  for (let i = 0; i < UpcomingContest.length; i++) {
    let flag = 0;
    for (let j = 0; j < eventItems.length; j++) {
      if (eventItems[j].description === `codeforces_contest_ID=${UpcomingContest[i].id}`) {
        flag = 1;
        break;
      }
    }
    if (flag === 0) {
      await calendarEventAdder(UpcomingContest[i], myAccessTokenVariable);
    }
  }
res.send("Contest rechecked");


});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
