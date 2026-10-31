#include "TestHarness.hpp"

#include <exception>
#include <iostream>

int main() {
  int failed = 0;
  for (const auto& test : testing::registry()) {
    try {
      test.body();
      std::cout << "[ PASS ] " << test.name << "\n";
    } catch (const std::exception& error) {
      ++failed;
      std::cout << "[ FAIL ] " << test.name << "\n         " << error.what() << "\n";
    }
  }
  std::cout << "\n" << (testing::registry().size() - failed) << "/" << testing::registry().size() << " tests passed\n";
  return failed == 0 ? 0 : 1;
}
