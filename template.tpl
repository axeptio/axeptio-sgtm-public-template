___INFO___

{
  "type": "TAG",
  "id": "cvt_temp_public_id",
  "version": 1,
  "securityGroups": [],
  "displayName": "Axeptio Tag",
  "brand": {
    "id": "Axeptio",
    "displayName": "Axeptio"
  },
  "description": "Axeptio",
  "containerContexts": [
    "SERVER"
  ]
}


___TEMPLATE_PARAMETERS___

[]


___SANDBOXED_JS_FOR_SERVER___

const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const JSON = require('JSON');
const Math = require('Math');
const sendPixelFromBrowser = require('sendPixelFromBrowser');
const sendHttpRequest = require('sendHttpRequest');
const getTimestampMillis = require('getTimestampMillis');
const setCookie = require('setCookie');
const getCookieValues = require('getCookieValues');
const getContainerVersion = require('getContainerVersion');
const getRequestHeader = require('getRequestHeader');
const logToConsole = require('logToConsole');
const sha256Sync = require('sha256Sync');
const decodeUriComponent = require('decodeUriComponent');
const parseUrl = require('parseUrl');
const computeEffectiveTldPlusOne = require('computeEffectiveTldPlusOne');
const generateRandom = require('generateRandom');
const getType = require('getType');
const makeString = require('makeString');
const makeNumber = require('makeNumber');

//const apiEndpoint = [data.domain, routeParams].join('/');
const eventData = getAllEventData();
const queryParameters = eventData.queryParameters;

logToConsole(eventData.requestPath);
logToConsole(eventData);

const requestHeaders = {};
/*
requestHeaders['User-Agent'] = eventData.user_agent;
requestHeaders.Referer = eventData.page_location;
requestHeaders['X-Forwarded-For'] = eventData.ip_override;
requestHeaders['content-type'] = 'application/json';
*/

var headerNames = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Cache-Control',
  'Content-Length',	
  'Content-Type',
  //'Cookie',
  'Dnt',
  'Forwarded',	
  //'Host',
  'Origin',	
  'Pragma',
  'Priority',	
  'Referer',
  'Sec-Ch-Ua',	
  'Sec-Ch-Ua-Mobile',	
  'Sec-Ch-Ua-Platform',	
  'Sec-Fetch-Dest',
  'Sec-Fetch-Mode',
  'Sec-Fetch-Site',	
  'Traceparent',
  'User-Agent',
  'Via'
];

headerNames.forEach((headerName) => {
   requestHeaders[headerName] = getRequestHeader(headerName);
});

const requestBody = eventData.requestBody;

/*if (eventData.path === '/analytics/evts') {
  
  sendHttpRequest('https://api.axept.io/v1' + eventData.requestPath, (statusCode, headers, body) => {
    if (statusCode >= 200 && statusCode < 300) {
      data.gtmOnSuccess();
    } else {
      data.gtmOnFailure();
    }
  }, {
    headers: requestHeaders,
    method: 'POST'
  }, requestBody);

} else */
  
  if (eventData.path === '/consents') {
  
  sendHttpRequest('https://api.axept.io/v1/app' + eventData.requestPath, (statusCode, headers, body) => {
    if (statusCode >= 200 && statusCode < 300) {
      data.gtmOnSuccess();
    } else {
      data.gtmOnFailure();
    }
  }, {
    headers: requestHeaders,
    method: 'POST'
  }, requestBody);

/*} else if (eventData.path === '/app/consent') {
  
  let queryStringArray = [];
  for (var parameter in queryParameters) {
    queryStringArray.push(parameter + '=' + queryParameters[parameter]);
  }
  const queryString = queryStringArray.join('&');
  
  sendHttpRequest('https://api.axept.io/v1' + eventData.requestPath + '?' + queryString, (statusCode, headers, body) => {
    if (statusCode >= 200 && statusCode < 300) {
      data.gtmOnSuccess();
    } else {
      data.gtmOnFailure();
    }
  }, {
    headers: requestHeaders,
    method: 'GET'
  });*/
    
} else {
  data.gtmOnSuccess();
}


___SERVER_PERMISSIONS___

[
  {
    "instance": {
      "key": {
        "publicId": "get_cookies",
        "versionId": "1"
      },
      "param": [
        {
          "key": "cookieAccess",
          "value": {
            "type": 1,
            "string": "any"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "logging",
        "versionId": "1"
      },
      "param": [
        {
          "key": "environments",
          "value": {
            "type": 1,
            "string": "debug"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "read_container_data",
        "versionId": "1"
      },
      "param": []
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "set_cookies",
        "versionId": "1"
      },
      "param": []
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "read_event_data",
        "versionId": "1"
      },
      "param": [
        {
          "key": "eventDataAccess",
          "value": {
            "type": 1,
            "string": "any"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "send_pixel_from_browser",
        "versionId": "1"
      },
      "param": [
        {
          "key": "allowedUrls",
          "value": {
            "type": 1,
            "string": "specific"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "send_http",
        "versionId": "1"
      },
      "param": [
        {
          "key": "allowedUrls",
          "value": {
            "type": 1,
            "string": "specific"
          }
        },
        {
          "key": "urls",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 1,
                "string": "https://api.axept.io/v1/*"
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "read_request",
        "versionId": "1"
      },
      "param": [
        {
          "key": "requestAccess",
          "value": {
            "type": 1,
            "string": "any"
          }
        },
        {
          "key": "headerAccess",
          "value": {
            "type": 1,
            "string": "any"
          }
        },
        {
          "key": "queryParameterAccess",
          "value": {
            "type": 1,
            "string": "any"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  }
]


___TESTS___

scenarios: []


___NOTES___

Created on 28/05/2024, 17:56:34


