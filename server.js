/**
 * Copyright 2019 Artificial Solutions. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *    http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
//const MessagingResponse = require('twilio').twiml.MessagingResponse;
const TIE = require('@artificialsolutions/tie-api-client');
const {
    TENEO_ENGINE_URL
} = process.env;

const port = process.env.PORT || 4337;
const teneoEngineUrl = process.env.TENEO_ENGINE_URL;
const postPath = {
    default: '/'
};

/*let twilioActions = {
    outbound_call: '/outbound',
    hang_up: '/hang_up'
};*/
let twilioAction = postPath.default;
const app = express();

// initalise teneo
const teneoApi = TIE.init(teneoEngineUrl);

// initialise session handler, to store mapping between sender's phone number and the engine session id
const sessionHandler = SessionHandler();

app.use(bodyParser.urlencoded({ extended: false }));

// twilio message comes in
//app.post("/outbound", handleTwilioMessages(sessionHandler));
app.post("/", handleAPIMessages(sessionHandler));
app.get("/", handleAPIMessages(sessionHandler));

function _stringify (o)
{
  const decircularise = () =>
  {
    const seen = new WeakSet();
    return (key,val) => 
    {
      if( typeof val === "object" && val !== null )
      {
        if( seen.has(val) ) return;
        seen.add(val);
      }
      return val;
    };
  };
  
  return JSON.stringify( o, decircularise() );
}

// handle incoming twilio message
function handleAPIMessages(sessionHandler) {
  return async (req, res) => {
    console.log("in handleAPIMessages");
    // get the sender's phone number
    var from = req.body.From;
    console.log(`from: ${from}`);

    // get message from user
    var userInput = req.body.Body;
    console.log(`REQUEST (flattened):`);
    console.log(_stringify(req));
    
    console.log(`RESPONSE (flattened):`);
    console.log(_stringify(res));
    //const triggerFrom = "+" + req.query["phone"].replace(/[^0-9]/g, '');  
    const triggerInput = req.query["userInput"];   
    //console.log(`from: ${triggerFrom}`);
    console.log(`userInput: ${triggerInput}`);
    var teneoSessionId = req.headers["session"];
    console.log(`my session ID: ${teneoSessionId}`);
    if(from===undefined || from===null || from=="") {
      userInput = triggerInput;
      console.log(`UPD1 from: ${from}`);
      console.log(`UPD2 userInput: ${userInput}`);
    }
    var teneoResponse = "";

    // check if we have stored an engine sessionid for this sender
    
    var teneoSessionId = sessionHandler.getSession(from);
    
     
    console.log(`my session ID: ${teneoSessionId}`);
    // send input to engine using stored sessionid and retreive response:
    teneoResponse = await teneoApi.sendInput(teneoSessionId, { 'text': userInput, 'channel': 'cai-connector' });
    console.log(`teneoResponse: ${teneoResponse.output.text}`);
    console.log(_stringify(teneoResponse));
    teneoSessionId = teneoResponse.sessionId;
    
    // store engine sessionid for this sender
    sessionHandler.setSession(from, teneoSessionId);

    // return teneo answer to twilio
     res.writeHead(200, { 'Content-Type': 'text/json' });
    res.end(teneoResponse.toString());
   //return teneoResponse;
  }
}




/***
 * SESSION HANDLER
 ***/
function SessionHandler() {

  // Map the sender's phone number to the teneo engine session id. 
  // This code keeps the map in memory, which is ok for testing purposes
  // For production usage it is advised to make use of more resilient storage mechanisms like redis
  const sessionMap = new Map();

  return {
    getSession: (userId) => {
      if (sessionMap.size > 0) {
        return sessionMap.get(userId);
      }
      else {
        return "";
      }
    },
    setSession: (userId, sessionId) => {
      sessionMap.set(userId, sessionId)
    }
  };
}

http.createServer(app).listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
