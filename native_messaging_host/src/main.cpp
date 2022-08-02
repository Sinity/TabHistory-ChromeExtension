#include "native_messaging.h"
#include "netsock/NetSock.h"

int main()
{
    NativeMessaging::init();
    NativeMessaging::sendMessage("Native messaging host started.");

    NetSock::InitNetworking();
    NetSock socket;

    auto connected = socket.Connect("127.0.0.1", 50332);

    while(true) {
        auto response = NativeMessaging::readResponse();
        if(response == "") {
            break;
        }

        //try to connect if we're not yet connected
        if(!connected) {
            connected = socket.Connect("127.0.0.1", 50332);
        }

        //if we're connected, send the data
        if(connected) {
            socket.Write(response.c_str(), response.size());
        }
    }

    return 0;
}
