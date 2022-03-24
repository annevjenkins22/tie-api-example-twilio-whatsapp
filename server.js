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
const qs = require('querystring');
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
      
    console.log("INBOUND START " );
            let body = '';

            req.on('data', function (data) {
                body += data;
            });

            req.on('end', async function () {
      console.log("IN ASYNC" );          
     const triggerInput = req.query["userInput"];   
     var post ;
     var from ;
     var userInput;
     var apiKey;
     var challenge  = req.query["challenge"];   
     var messageId="";
     if((triggerInput===undefined || triggerInput===null) && body!=null && body!==undefined) {
         console.log("trying to parse body" );  
         try {
         post = JSON.parse(body);
         console.log("trying to parse body 2" );  
         from = post.from;
         console.log("trying to parse body 3" );  
         userInput = post.userInput;
         apiKey = post.apiKey;
         challenge=post.challenge;
          console.log("trying to parse body 4" );  
         }
         catch(err) { 
           console.log(err.message);   
         }
         if(post!=null && post!==undefined && post.deltas!=null && post.deltas!==undefined) {
             userInput="Dealer test drive response";
             messageId= post.deltas[0].object_data.id;
         }
             
     }
      if(userInput===undefined || userInput===null || userInput=="") {
      userInput = triggerInput;
      apiKey =  req.query["apiKey"];   
      from = req.query["from"];   
      console.log(`UPD3 from: ${from}`);
      console.log(`UPD4 userInput: ${userInput}`);
          if(userInput===undefined || userInput===null || userInput=="") {
              
              userInput="hello";
          }
    }
     if(challenge===undefined || challenge===null || challenge=="") {
         challenge="";
     }           
     if(apiKey===undefined || apiKey===null || apiKey=="") {
         apiKey="";
     }
    console.log(`from: ${from}`);
    console.log(`body: ${body}`);
   
    // get message from user
      console.log(userInput);
      console.log(apiKey);
    console.log(`REQUEST (flattened):`);
    console.log(_stringify(req));
    
    console.log(`RESPONSE (flattened):`);
    console.log(_stringify(res));
    //const triggerFrom = "+" + req.query["phone"].replace(/[^0-9]/g, '');  
   
    //console.log(`from: ${triggerFrom}`);
    console.log(`userInput: ${triggerInput}`);
    var teneoSessionId = req.headers["session"];
    console.log(`my session ID: ${teneoSessionId}`);


    var teneoResponse = "";

    // check if we have stored an engine sessionid for this sender
    
    var teneoSessionId = sessionHandler.getSession(from);
    
     
    console.log(`my session ID: ${teneoSessionId}`);
    // send input to engine using stored sessionid and retreive response:
    teneoResponse = await teneoApi.sendInput(teneoSessionId, { 'text': userInput, 'channel': 'cai-connector', 'apiKey': apiKey, 'messageId' : messageId });
    console.log(`teneoResponse: ${teneoResponse.output.text}`);
    console.log(_stringify(teneoResponse));
    teneoSessionId = teneoResponse.sessionId;
    
    // store engine sessionid for this sender
    sessionHandler.setSession(from, teneoSessionId);

    // return teneo answer to twilio
     res.writeHead(200, { 'Content-Type': 'text/json' });
     if(challenge=="") {
        res.end(_stringify(teneoResponse));
     }
     else {
         res.end(challenge);
     }
                
   //return teneoResponse;
  });
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
