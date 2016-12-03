#include "native_messaging.h"
#include "outbound_named_pipe.h"

int main()
{
    NativeMessaging::init();
    OutboundNamedPipe pipe("\\\\.\\pipe\\the_pajp");

    NativeMessaging::sendMessage("Native messaging host is running.");

    while(true) {
        auto response = NativeMessaging::readResponse();
        if(response == "") {
            break;
        }

        pipe.send(response.c_str());
    }

    return 0;
}
