"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  analyzeAudio: true
};
exports.analyzeAudio = analyzeAudio;
var _reactNative = require("react-native");
var _helpers = require("./helpers");
Object.keys(_helpers).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _helpers[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _helpers[key];
    }
  });
});
const LINKING_ERROR = `The package 'react-native-audio-analyzer' doesn't seem to be linked. Make sure: \n\n` + _reactNative.Platform.select({
  ios: "- You have run 'pod install'\n",
  default: ''
}) + '- You rebuilt the app after installing the package\n' + '- You are not using Expo Go\n';
const AudioAnalyzer = _reactNative.NativeModules.AudioAnalyzer ? _reactNative.NativeModules.AudioAnalyzer : new Proxy({}, {
  get() {
    throw new Error(LINKING_ERROR);
  }
});
function analyzeAudio(filepath) {
  return AudioAnalyzer.analyzeAudio(filepath);
}
//# sourceMappingURL=index.js.map