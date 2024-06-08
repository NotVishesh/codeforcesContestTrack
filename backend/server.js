require("dotenv").config();
const { google } = require("googleapis");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const cors = require("cors");

const app = express();

// Enable CORS for all routes
app.use(cors());

async function getContestList() {
  try {
    const response = await fetch("https://codeforces.com/api/contest.list");
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error("Error:", error);
  }
}

async function fetchEventsList(EventsListUrl, tokens) {
  try {
    const response = await fetch(EventsListUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    // console.log(data.items);
    return data.items;
    // Handle the response data here
  } catch (error) {
    console.error("Fetch error:", error);
    // Handle errors here
  }
}

// Usage example
// const EventsListUrl = 'YOUR_EVENTS_LIST_URL';
// const tokens = { access_token: 'YOUR_ACCESS_TOKEN' };



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

// const AllEventList = async (EventsListUrl,access_token) => {
//   const response = await fetch(EventsListUrl, {
//    method: "GET",
//    headers: {
//      "Authorization": `Bearer ${access_token}`,
//      "Accept": "application/json"
//    }
//  })
//   if (!response.ok) {
//     throw new Error(`HTTP error! Status: ${response.status}`);
//   }
//   console.log(response.json().items);
//   return response.json();

// }

// Setup session middleware
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

const scopes = [
  "https://www.googleapis.com/auth/calendar",
];

const state = crypto.randomBytes(32).toString("hex");
session.state = state;

app.get("/auth", (req, res) => {
  req.session.state = state;

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    include_granted_scopes: true,
    state: state,
  });
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
    // console.log(UpcomingContest);
    
   

    const eventItems = await fetchEventsList(EventsListUrl, tokens);
    // console.log(eventItems);


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
  

    res.send("Authentication successful!");
  } catch (error) {
    console.error("Error retrieving access token:", error);
    res.status(500).send("Authentication failed");
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
