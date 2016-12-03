#include "inbound_named_pipe.h"
#include <cstdio>
#include <array>

InboundNamedPipe::InboundNamedPipe(std::string pipeName) :
    pipeName(std::move(pipeName)) {
}

InboundNamedPipe::~InboundNamedPipe() {
    CloseHandle(pipe);
}

bool InboundNamedPipe::connect() {
    pipe = CreateFileA(pipeName.c_str(), GENERIC_READ | FILE_WRITE_ATTRIBUTES,
                       FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING,
                       FILE_ATTRIBUTE_NORMAL, nullptr);

    if(pipe == INVALID_HANDLE_VALUE) {
        fprintf(stderr, "Failed to connect to the pipe\n");
        return false;
    }

    DWORD messageMode = PIPE_READMODE_MESSAGE;
    auto setMessageMode = SetNamedPipeHandleState(pipe, &messageMode, nullptr, nullptr);

    if(setMessageMode) {
        validConnection  = true;
    } else {
        fprintf(stderr, "Failed to set connection to pipe to message-read mode. GLE=%d\n", GetLastError());
        return false;
    }

    return true;
}

std::string InboundNamedPipe::read() {
    if(!validConnection) {
        return "";
    }

    std::array<char, 4096> buffer;
    DWORD bytesRead = 0;

    auto result = ReadFile(pipe, &buffer[0], (DWORD)buffer.size() - 1, &bytesRead, nullptr);
    if(!result) {
        return "";
    }

    buffer[bytesRead] = '\0';
    return std::string(&buffer[0]);
}
