#pragma once
#include <thread>
#include <future>
#include <utility>
#include <windows.h>

class OutboundNamedPipe {
public:
    OutboundNamedPipe(const std::string& pipeName);
    ~OutboundNamedPipe();

    // send message through the pipe, synchronously
    // returns: whether the operation was successfull or not
    bool send(const std::string& message);

private:
    HANDLE pipe;
    bool connected = false;
};
