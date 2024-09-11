#pragma once

#include <jsi/jsi.h>
#include <ReactCommon/CallInvoker.h>
#include <string>

using namespace facebook;

class AnalyzerRuntime : public jsi::HostObject {
public:
    AnalyzerRuntime(jsi::Runtime &runtime, std::shared_ptr<react::CallInvoker> callInvoker);

    jsi::Value multiply(double a, double b);
    jsi::Value analyze(std::string filename, double groupBySeconds);

    std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime &runtime) override;

    jsi::Value get(jsi::Runtime &runtime, const jsi::PropNameID &name) override;

private:
    jsi::Runtime &_rt;
    std::shared_ptr<react::CallInvoker> callInvoker_; // TODO: Run on different thread

    static jsi::Function _createMultiplyFunction(jsi::Runtime &runtime, AnalyzerRuntime *testAppRuntime);
    static jsi::Function _createAnalyzeFunction(jsi::Runtime &runtime, AnalyzerRuntime *testAppRuntime);
};

