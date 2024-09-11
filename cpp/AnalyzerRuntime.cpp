#include "AnalyzerRuntime.h"
#include "AudioAnalyzer.h"

using namespace audioanalyzer;

AnalyzerRuntime::AnalyzerRuntime(jsi::Runtime &runtime,
                                 std::shared_ptr<react::CallInvoker> callInvoker)
        : _rt(runtime), callInvoker_(callInvoker) {}

jsi::Value AnalyzerRuntime::multiply(double a, double b) {
    return jsi::Value(a * b);
}

jsi::Value AnalyzerRuntime::analyze(std::string filename, double groupBySeconds) {

    std::vector<AmplitudeData> amplitudeDataList = audioanalyzer::analyzeAudio(filename,
                                                                               groupBySeconds);

    jsi::Array jsArray(this->_rt, amplitudeDataList.size());

    for (size_t i = 0; i < amplitudeDataList.size(); ++i) {
        const AmplitudeData &data = amplitudeDataList[i];

        jsi::Object jsObject(this->_rt);
        jsObject.setProperty(this->_rt, "time", data.timeInSeconds);
        jsObject.setProperty(this->_rt, "amplitude", data.amplitude);

        jsArray.setValueAtIndex(this->_rt, i, std::move(jsObject));
    }

    return jsArray;
}

std::vector<jsi::PropNameID> AnalyzerRuntime::getPropertyNames(jsi::Runtime &runtime) {
    std::vector<jsi::PropNameID> result;
    result.push_back(jsi::PropNameID::forAscii(runtime, "multiply"));
    result.push_back(jsi::PropNameID::forAscii(runtime, "analyze"));
    return result;
}

jsi::Value AnalyzerRuntime::get(jsi::Runtime &runtime, const jsi::PropNameID &name) {
    auto propName = name.utf8(runtime);
    if (propName == "multiply") {
        return AnalyzerRuntime::_createMultiplyFunction(runtime, this);
    } else if (propName == "analyze") {
        return AnalyzerRuntime::_createAnalyzeFunction(runtime, this);
    }
    return jsi::Value::undefined();
}

jsi::Function AnalyzerRuntime::_createMultiplyFunction(jsi::Runtime &runtime, AnalyzerRuntime *testAppRuntime) {
    return jsi::Function::createFromHostFunction(
            runtime, jsi::PropNameID::forAscii(runtime, "multiply"), 2,
            [testAppRuntime](jsi::Runtime &runtime, const jsi::Value &, const jsi::Value *args,
                             size_t count) -> jsi::Value {
                if (count != 2 || !args[0].isNumber() || !args[1].isNumber()) {
                    throw jsi::JSError(runtime, "multiply expects two numbers");
                }
                return testAppRuntime->multiply(args[0].asNumber(), args[1].asNumber());
            });
}


jsi::Function AnalyzerRuntime::_createAnalyzeFunction(jsi::Runtime &runtime, AnalyzerRuntime *testAppRuntime) {
    return jsi::Function::createFromHostFunction(
            runtime, jsi::PropNameID::forAscii(runtime, "analyze"), 2,
            [testAppRuntime](jsi::Runtime &runtime, const jsi::Value &, const jsi::Value *args,
                             size_t count) -> jsi::Value {
                if (count != 2 || !args[0].isString() || !args[1].isNumber()) {
                    throw jsi::JSError(runtime,
                                       "analyze expects filepath as String and groupBySeconds as number");
                }
                return testAppRuntime->analyze(args[0].asString(runtime).utf8(runtime), args[1].asNumber());
            });
}
