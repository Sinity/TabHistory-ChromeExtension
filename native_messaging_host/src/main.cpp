#include "native_messaging.h"

int main()
{
    NativeMessaging::init();
    NativeMessaging::sendMessage("Native messaging host started.");

    while(true) {
        auto response = NativeMessaging::readResponse();
        if(response == "") {
            break;
        }

        //TODO: send the response to the main app
    }

    return 0;
}
