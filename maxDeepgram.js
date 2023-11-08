// references:
// https://cycling74.com/projects/shakespeare-talkbot-with-chatgpt-and-jitter

const { Deepgram } = require("@deepgram/sdk");
const recorder = require("node-record-lpcm16");
const maxApi = require("max-api");
require('dotenv').config();

const { delimiter } = require("path");

const paths = process.env.PATH.split(delimiter);
// need to install homebrew to install sox audio capture
paths.push("/usr/local/bin/"); // Location of sox, verify in terminal with this command: $ which sox
process.env.PATH = paths.join(delimiter);

// Your Deepgram API Key
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

// Initialize the Deepgram SDK
const deepgram = new Deepgram(deepgramApiKey);

// Create a connection to Deepgram
// In this example, punctuation is turned on, interim results are turned off, and language is set to UK English.
const deepgramLive = deepgram.transcription.live({
  punctuate: true,
  interim_results: false,
  language: "en-US",
  encoding: "linear16",
  sample_rate: 48000
});

const recording = recorder.record({
    sampleRate: 48000,
});

maxApi.addHandlers({
	pause: () => recording.pause(),
	resume: () => recording.resume()
});

// Listen for messages from Max
// maxApi.addHandler("message", (message) => {
  // Check if the message is "resume" to restart recording
//  if (message === "resume") {
//    recording.resume();    //  Resume recording
//  }
// });

// Listen for any data available from the recording stream
recording.stream().on("data", (chunk) => {
  // Check if the WebSocket is ready to receive data
  if (deepgramLive.getReadyState() === 1) {
    // Send the chunk of audio data to Deepgram
    deepgramLive.send(chunk);
  }
});

// Listen for the connection to close
deepgramLive.addListener("close", () => {
  console.log("Connection closed.");
});

// Listen for any transcripts received from Deepgram and write them to the console
deepgramLive.addListener("transcriptReceived", (message) => {
  const data = JSON.parse(message);

  // Check if data is defined and contains the expected structure
  if (data && data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
    const transcript = data.channel.alternatives[0].transcript;

    if (transcript) {
      // Pause the recorder before sending the transcript
      recording.pause();
      // Send the transcript message to Max
      maxApi.outlet(transcript);
	  maxApi.outlet('pause');
    }
  } else {
    console.log("Invalid or missing data in the response.");
  }
});