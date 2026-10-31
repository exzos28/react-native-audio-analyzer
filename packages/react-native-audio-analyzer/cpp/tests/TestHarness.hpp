#pragma once

// A deliberately tiny test harness: the core has no third-party test
// dependency, so the tests build offline with nothing but a C++20 compiler.

#include <cmath>
#include <functional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace testing {

struct TestCase {
  const char* name;
  std::function<void()> body;
};

inline std::vector<TestCase>& registry() {
  static std::vector<TestCase> tests;
  return tests;
}

struct Registrar {
  Registrar(const char* name, std::function<void()> body) {
    registry().push_back({name, std::move(body)});
  }
};

struct Failure : std::runtime_error {
  using std::runtime_error::runtime_error;
};

inline std::string location(const char* file, int line) {
  std::ostringstream out;
  out << file << ":" << line;
  return out.str();
}

} // namespace testing

#define TEST_CONCAT_INNER(a, b) a##b
#define TEST_CONCAT(a, b) TEST_CONCAT_INNER(a, b)

#define TEST(name)                                                                              \
  static void TEST_CONCAT(test_, name)();                                                       \
  static const testing::Registrar TEST_CONCAT(registrar_, name)(#name, TEST_CONCAT(test_, name)); \
  static void TEST_CONCAT(test_, name)()

#define EXPECT_TRUE(condition)                                                                    \
  do {                                                                                            \
    if (!(condition)) {                                                                           \
      throw testing::Failure(testing::location(__FILE__, __LINE__) + ": expected " #condition);   \
    }                                                                                             \
  } while (false)

#define EXPECT_EQ(actual, expected)                                                                     \
  do {                                                                                                  \
    const auto& actualValue = (actual);                                                                 \
    const auto& expectedValue = (expected);                                                             \
    if (!(actualValue == expectedValue)) {                                                              \
      std::ostringstream message;                                                                       \
      message << testing::location(__FILE__, __LINE__) << ": expected " #actual " == " #expected ", got " \
              << actualValue << " vs " << expectedValue;                                                \
      throw testing::Failure(message.str());                                                            \
    }                                                                                                   \
  } while (false)

#define EXPECT_NEAR(actual, expected, tolerance)                                                     \
  do {                                                                                               \
    const double actualValue = (actual);                                                             \
    const double expectedValue = (expected);                                                         \
    if (!(std::fabs(actualValue - expectedValue) <= (tolerance))) {                                  \
      std::ostringstream message;                                                                    \
      message << testing::location(__FILE__, __LINE__) << ": expected " #actual " ~= " << expectedValue \
              << ", got " << actualValue;                                                            \
      throw testing::Failure(message.str());                                                         \
    }                                                                                                \
  } while (false)

// Passes if `statement` throws `ExceptionType` whose what() contains `substring`.
#define EXPECT_THROWS(statement, ExceptionType, substring)                                                 \
  do {                                                                                                     \
    bool threw = false;                                                                                    \
    try {                                                                                                  \
      statement;                                                                                           \
    } catch (const ExceptionType& error) {                                                                 \
      threw = true;                                                                                        \
      if (std::string(error.what()).find(substring) == std::string::npos) {                                \
        throw testing::Failure(testing::location(__FILE__, __LINE__) + ": unexpected message: " + error.what()); \
      }                                                                                                    \
    }                                                                                                      \
    if (!threw) {                                                                                          \
      throw testing::Failure(testing::location(__FILE__, __LINE__) + ": expected " #statement              \
                                                                     " to throw " #ExceptionType);         \
    }                                                                                                      \
  } while (false)
