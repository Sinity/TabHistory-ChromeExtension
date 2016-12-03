#include "native_messaging.h"
#include <iostream>
#ifdef _WIN32
    #include <io.h>
    #include <fcntl.h>
#endif
using namespace std::string_literals;

std::string readRawResponse();
std::string parseResponse(const std::string& response);
void sendRawMessage(const std::string& message);


void NativeMessaging::init() {
#ifdef _WIN32
    setmode(fileno(stdout), O_BINARY);
    setmode(fileno(stdin), O_BINARY);
#endif
}

std::string NativeMessaging::readResponse() {
    return parseResponse(readRawResponse());
}

void NativeMessaging::sendMessage(const std::string& message) {
    sendRawMessage("{\"msg\":\"" + message +  "\"}");
}


std::string readRawResponse() {
    auto length = 0u;

    for (auto i = 0; i < 4; i++) {
        int input = getchar();
        if(input == EOF) {
            return "";
        }

        *((char*)&length + i) = input;
    }

    auto response = ""s;
    response.reserve(length);

    for (auto i = 0u; i < length; i++) {
        response += getchar();
    }

    return response;
}

std::string parseResponse(const std::string& response) {
    //response format: '{some_identifier: "message"...', only 'message' matters, so we extract that.

    auto colonPos = response.find(':');
    if(colonPos == std::string::npos) {
        return "";
    }

    auto responseOpenQuotePos = response.find('\"', colonPos);
    if(responseOpenQuotePos == std::string::npos) {
        return "";
    }

    auto responseCloseQuotePos = response.find('\"', responseOpenQuotePos + 1);
    if(responseCloseQuotePos == std::string::npos) {
        return "";
    }

    return response.substr(responseOpenQuotePos + 1, responseCloseQuotePos - responseOpenQuotePos - 1);
}

void sendRawMessage(const std::string& message) {
    auto len = message.length();

    std::cout   << (char)len
                << (char)(len>>8)
                << (char)(len>>16)
                << (char)(len>>24);

    std::cout << message << std::flush;
}

