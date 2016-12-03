#pragma once
#include <string>
#include <windows.h>

class InboundNamedPipe {
public:
    InboundNamedPipe(std::string pipeName);
    ~InboundNamedPipe();

    //tries to connect to the pipe, returns whether it did.
    bool connect();

    // tries to read an message from the pipe
    // returns: empty string on failure, received message on success
    // todo: can't handle messages bigger than 4095 bytes. Also, it isn't very optimal.
    std::string read();

private:
    HANDLE pipe;
    std::string pipeName;
    bool validConnection = false;
};
