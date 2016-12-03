#include "outbound_named_pipe.h"
#include <cstdio>
#include <cstring>

OutboundNamedPipe::OutboundNamedPipe(const std::string& pipeName) {
    pipe = CreateNamedPipeA(pipeName.c_str(), PIPE_ACCESS_OUTBOUND, PIPE_TYPE_MESSAGE, 1, 0, 0, 0, nullptr);

    if(pipe == INVALID_HANDLE_VALUE) {
        fprintf(stderr, "Cannot create named pipe");
    }
}

OutboundNamedPipe::~OutboundNamedPipe() {
    CloseHandle(pipe);
}

bool OutboundNamedPipe::send(const std::string& message) {
    if(pipe == INVALID_HANDLE_VALUE) {
        return false;
    }

    if(!connected) {
        connected = ConnectNamedPipe(pipe, nullptr) || GetLastError() == ERROR_PIPE_CONNECTED;
    }

    if(!connected) {
        return false;
    }

    DWORD bytesWritten = 0;

    auto writeSuccessful = WriteFile(pipe, message.c_str(), (DWORD)message.length(), &bytesWritten, nullptr);
    if(writeSuccessful && bytesWritten == message.length()) {
        return true;
    }

    return false;
}
