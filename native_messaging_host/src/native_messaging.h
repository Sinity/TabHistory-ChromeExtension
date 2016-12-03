#pragma once
#include <string>

namespace NativeMessaging {
    void init();
    std::string readResponse();
    void sendMessage(const std::string& message);
}
