#include <cstdio>
#include "inbound_named_pipe.h"

int main() {
    printf("Hello World!\n\n");

    InboundNamedPipe pipe("\\\\.\\pipe\\the_pajp");

    while(true) {
        std::string message = pipe.read();
        if(message == "") {
            pipe.connect();
            message = pipe.read();
        }

        puts(message.c_str());
    }


    printf("\nBye then.");
    return 0;
}
