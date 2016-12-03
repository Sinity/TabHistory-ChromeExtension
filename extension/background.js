var nativeMessagingPort = {};

// Creates a connection to native messaging host, and registers handlers for logging about connection state
function setupNativeMessaging() {
    var nativeMessagingHostName = "ezo.stayproductive.native_messaging_host";
	nativeMessagingPort = chrome.runtime.connectNative(nativeMessagingHostName);

	nativeMessagingPort.onMessage.addListener(function(response) {
		console.log("Message from native messaging host: " + response.msg);
	});

	nativeMessagingPort.onDisconnect.addListener(function() {
		//console.log("Native messaging host has disconnected, attempting reconnect");
        setupNativeMessaging();
	});
}

function nmMessage(message) {
    //nativeMessagingPort.postMessage({"msg": message});
    console.log(message);
}

var currentTab = 0; //currently active tab
var previousTab = 0; // tab that was active before currentTab

// Maps tab ID's to tab records.
// Each tab record is composed of array of URL entries and index in this array indicating which URL entry is current URL entry of a given tab
// URL entry is a two-element array, where first element is transition type(how user got there) and second is URL itself
// Example tab record: tabHistory[123] = {currentEntry: 1, entries: [["typed", "google.com"], ["link", "youtube.com"]]};
var tabHistory = {};
var closedTabHistory = []; // stores tab records of closed tabs, most recently closed first

// Used to know when data located in the memory has diverged from data stored persistently
var tabHistoryModified = false;
var closedTabHistoryModified = false;

// vars used to synchronize execution of code
var tabsInitialized = false;
var loadingFinished = false;
var activeTabDataInitialized = false;

// consts for arbitrary values
const maxTabHistorySize = 100;
const maxRememberedTabRecords = 100;
const msTillNextTabDataSaveAttempt = 1000;
const msToWaitForOnCommitedEvent = 150;
const msWaitingPeriodBeforeSendingTabHistory = 250;



// Loads tab data from the persistent storage
function loadTabData() {
	chrome.storage.local.get(["closedTabHistory", "lastSessionTabHistory"], function(loadedVariables) {
		if(chrome.runtime.lastError) {
		    loadingFinished = true;
            return;
		}

		if(loadedVariables.closedTabHistory != undefined) {
			closedTabHistory = loadedVariables.closedTabHistory;

			//detect if data isn't corrupted, remove it if it is
			for(var i = 0; i < closedTabHistory.length; i++) {
				if(closedTabHistory[i] == undefined ||
					closedTabHistory[i].entries == undefined ||
					closedTabHistory[i].currentEntry == undefined ||
                    closedTabHistory[i].currentEntry >= closedTabHistory[i].entries.length) {

					closedTabHistory.splice(i, 1);
					i--;
					continue;
				}
			}
        }

		if(loadedVariables.lastSessionTabHistory != undefined) {
			var keys = Object.keys(loadedVariables.lastSessionTabHistory).map(Number).sort(function(a, b) { return a - b; });
			for(var i = 0; i < keys.length; i++) {
			    //detect if data isn't corrupted
			    if(loadedVariables.lastSessionTabHistory[keys[i]] == undefined ||
                loadedVariables.lastSessionTabHistory[keys[i]].entries == undefined ||
                loadedVariables.lastSessionTabHistory[keys[i]].currentEntry == undefined ||
                loadedVariables.lastSessionTabHistory[keys[i]].currentEntry >= loadedVariables.lastSessionTabHistory[keys[i]].entries.length) {
			        continue;
                }

				closedTabHistory.unshift(loadedVariables.lastSessionTabHistory[keys[i]]);
			}
        }

		loadingFinished = true;
	});
}

// Continuously saves TabData to the persistent storage when it's modified
function saveTabDataWhenModified() {
	if(closedTabHistoryModified) {
		chrome.storage.local.set({'closedTabHistory': closedTabHistory});
		closedTabHistoryModified = false;
	}

	if(tabHistoryModified) {
		chrome.storage.local.set({'lastSessionTabHistory': tabHistory});
		tabHistoryModified = false;
	}

	window.setTimeout(saveTabDataWhenModified, msTillNextTabDataSaveAttempt);
}



// Initialize tabHistory with records about currently opened tabs, using data from previous session if available
// Also initializes currentTab and previousTab to the ID of currently active tab
function initializeTabData() {

    // Wait for data about past tab records
	if(!loadingFinished) {
		window.setTimeout(initializeTabData, 200);
		return;
	}

	// Initialize currentTab and previousTab to sensible values
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		currentTab = previousTab = tabs[0].id;
		activeTabDataInitialized = true;
	});

	// Fill tabHistory with currently open tabs, both their history and current URLs
	chrome.tabs.query({}, function (openTabs) {
		for(var tab = 0; tab < openTabs.length; tab++) {
			var tabID = openTabs[tab].id;
			var URL = openTabs[tab].url;

			// try to recover it from our data
			for(var i = 0; i < closedTabHistory.length; i++) {
				var currentEntryIdx = closedTabHistory[i].currentEntry;
				if(closedTabHistory[i].entries[currentEntryIdx][1] == URL) {
					tabHistory[tabID] = closedTabHistory[i];
					closedTabHistory.splice(i, 1);
					closedTabHistoryModified = true;
					break;
				}
			}

			//if it didn't work, initialize it without any history
			if(tabHistory[tabID] == undefined) {
				tabHistory[tabID] = {};
				tabHistory[tabID].entries = [["typed", URL]];
				tabHistory[tabID].currentEntry = 0;
			}

			tabHistoryModified = true;
		}

		tabsInitialized = true;
	});
}



function isTransitionManual(transitionType) {
    var manualTransitionTypes = ["typed", "auto_bookmark", "generated", "start_page", "keyword", "keyword_generated"];
    var followTransitionTypes = ["link", "auto_subframe", "manual_subframe", "form_submit"];
    return manualTransitionTypes.includes(transitionType) ?  true : false;
}

function stripURL(URL) {
    if(URL.startsWith("https")) {
        URL = URL.slice(8);
    } else if(URL.startsWith("http")) {
        URL = URL.slice(7);
    }

    if(URL.startsWith("www")) {
        URL = URL.slice(4);
    }

    return URL;
}

// sends tab history to the native messaging host
// recent entries first, starting from current entry up to first 'manual' entry OR to the first recorded entry
// first item is ALWAYS current URL as reported by Tab API.
function sendTabHistory(tabID, activeURL) {
    var message = "";
    var activeURL = stripURL(activeURL);
    var currentEntryURL = stripURL(tabHistory[tabID].entries[tabHistory[tabID].currentEntry][1]);

    if(activeURL != currentEntryURL) {
        var message = activeURL + " ";
    }

    for(var i = tabHistory[tabID].currentEntry; i >= 0; i--) {
        message += stripURL(tabHistory[tabID].entries[i][1]) + " ";

        if(isTransitionManual(tabHistory[tabID].entries[i][0])) {
            break;
        }
    }

    nmMessage(message);
}

// Sets event handlers responsible for reporting which tab is currently active and its URL
// Also, runs code responsible for reporting navigation events which for some reason don't fire WebNavigation events
function setupURLTracking() {
	chrome.tabs.onActivated.addListener(function(activeTabInfo) {
		previousTab = currentTab;
		currentTab = activeTabInfo.tabId;

		chrome.tabs.get(currentTab, function(activeTab) {
            window.setTimeout(sendTabHistory, msWaitingPeriodBeforeSendingTabHistory, activeTab.id, activeTab.url);
		});
	});

	chrome.tabs.onUpdated.addListener(function(tabID, changeInfo, tab) {
		if(changeInfo.url != undefined) {
			chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
				if(tabID == tabs[0].id) {
                    window.setTimeout(sendTabHistory, msWaitingPeriodBeforeSendingTabHistory, tabID, changeInfo.url);
				}
			});

			window.setTimeout(handleDynamicNavigation, msToWaitForOnCommitedEvent, tabID, changeInfo.url);
		}
	});
}



// Removes old history record for a tab if number of them reached maxTabHistorySize threshold
function pruneExcessTabHistory(tabID) {
    var deleteCount = tabHistory[tabID].entries.length - maxTabHistorySize;
    if(deleteCount > 0 && tabHistory[tabID].currentEntry >= deleteCount) {
        tabHistory[tabID].entries.splice(0, deleteCount);
        tabHistory[tabID].currentEntry -= deleteCount;
    }
}



function handleDynamicNavigation(tabID, URL) {
    // in tabHistory URL's are always real, but in tab's data newtab URL is marked as this. So I have to detect it
    // to prevent false positive(detecting WebNavigation didn't do it's job while it actually did)
    var newtabURL = "chrome://newtab";
    if(URL.substring(0, newtabURL.length) == newtabURL) {
        return;
    }

	// Skip if already handled by WebNavigation event handlers
	var currentEntryIdx = tabHistory[tabID].currentEntry;
	if(tabHistory[tabID].entries[currentEntryIdx][1] == URL) {
		return;
	}

	var previousURL = currentEntryIdx != 0 ? tabHistory[tabID].entries[currentEntryIdx - 1][1] : "";
	var nextURL = currentEntryIdx + 1 < tabHistory[tabID].entries.length ? tabHistory[tabID].entries[currentEntryIdx + 1][1] : "";

	if(previousURL == nextURL && nextURL != "") {
        // it's most likely forwards or backwards navigation, but there is no data to tell which is it. So we wipe out
        // history of this tab, as now there is no way for it to remain correct.
		tabHistory[tabID].entries = [["typed", URL]];
		tabHistory[tabID].currentEntry = 0;
	} else if(URL == previousURL) {
        tabHistory[tabID].currentEntry--;
	} else if(URL == nextURL) {
        tabHistory[tabID].currentEntry++;
	} else {
        // It's neither forward nor backward navigation, so it's most likely a clicked link
        tabHistory[tabID].entries.splice(currentEntryIdx + 1, tabHistory[tabID].entries.length - currentEntryIdx + 1);
		tabHistory[tabID].entries.push(["link", URL]);
		tabHistory[tabID].currentEntry++;
	}

	tabHistoryModified = true;
}

function handleForwardBackNavigation(tabID, transitionType, URL) {
    var currentEntryIdx = tabHistory[tabID].currentEntry;
    var previousURL = currentEntryIdx != 0 ? tabHistory[tabID].entries[currentEntryIdx - 1][1] : "";
	var nextURL = currentEntryIdx + 1 < tabHistory[tabID].entries.length ? tabHistory[tabID].entries[currentEntryIdx + 1][1] : "";

    if(previousURL == nextURL || (URL != previousURL && URL != nextURL) || tabHistory[tabID] == undefined) {
	    // There is no data to distinguish between forward and backward navigation in this case.
        // We wipe out this tab history, as otherwise it would be incorrect
        tabHistory[tabID] = {};
		tabHistory[tabID].entries = [[transitionType, URL]];
		tabHistory[tabID].currentEntry = 0;
	} else if(URL == previousURL) {
		tabHistory[tabID].currentEntry--;
	} else {
		tabHistory[tabID].currentEntry++;
	}

	tabHistoryModified = true;
}

function handleReloadedTab(tabID, URL) {
    // It's only a 'normal' reload, don't do anything
	if(tabHistory[tabID] != undefined) {
        return;
    }

    // It's most likely reopened tab, find it - it we can't, then we just add it's current state to tabHistory
    tabHistoryModified = true;

    // Try to recover it from past data
    for(var i = 0; i < closedTabHistory.length; i++) {
        var currentEntryIdx = closedTabHistory[i].currentEntry;
        if(closedTabHistory[i].entries[currentEntryIdx][1] == URL) {
            tabHistory[tabID] = closedTabHistory[i];
            closedTabHistory.splice(i, 1);
            closedTabHistoryModified = true;
            return;
        }
    }

    tabHistory[tabID] = {};
    tabHistory[tabID].entries = [["typed", URL]];
    tabHistory[tabID].currentEntry = 0;
}

function handleNewTab(tabID, transitionType, URL) {
	chrome.tabs.get(tabID, function (tab) {
	    // initialize tabHistory entry
		tabHistory[tabID] = {};
        tabHistory[tabID].entries = [];
        tabHistory[tabID].currentEntry = -1;

        var newtabURL = "chrome://newtab";
		if(tab.url.substring(0, newtabURL.length) != newtabURL) {
		    // Tab was created from another one

			var sourceID = tabID != currentTab ? currentTab : previousTab;
			if(tabHistory[sourceID] != undefined) {
                var sourceURL = tabHistory[sourceID].entries[tabHistory[sourceID].currentEntry][1];
                tabHistory[tabID].entries = tabHistory[sourceID].entries;
                tabHistory[tabID].currentEntry = tabHistory[sourceID].currentEntry;
                tabHistory[tabID].entries.splice(tabHistory[tabID].currentEntry + 1,
                    tabHistory[tabID].entries.length - tabHistory[tabID].currentEntry + 1);
			}
		}

		tabHistory[tabID].entries.push([transitionType, URL]);
		tabHistory[tabID].currentEntry++;
		pruneExcessTabHistory(tabID);
		tabHistoryModified = true;
	});
}

function setupTabHistoryTracking() {
	chrome.webNavigation.onCommitted.addListener(function(details) {
	    // We're interested in 'main' sites only, not frames
		if(details.frameId != 0) {
			return;
		}

		// Handle forward/backward navigation
		for(var i = 0; i < details.transitionQualifiers.length; i++) {
			if(details.transitionQualifiers[i] == "forward_back") {
				handleForwardBackNavigation(details.tabId, details.transitionType, details.url);
				return;
			}
		}

		// Handle transitionType == reload.
		if(details.transitionType == "reload") {
			handleReloadedTab(details.tabId, details.url);
			return;
		}

		// Handle navigation happening in a new/unknown tab
        // (which isn't reload, so it's user opening link in the new tab or simply opening new tab)
		if(tabHistory[details.tabId] == undefined) {
			handleNewTab(details.tabId, details.transitionType, details.url);
			return;
		}

		// URL is the same as previous one, so it IS a reload. But for some reason sometimes it's reported as link.
		if(tabHistory[details.tabId].entries[tabHistory[details.tabId].currentEntry][1] == details.url) {
			return;
		}

        // Handle 'normal' case - user typing URL in the address bar, user opening a link in the same tab, etc.
        var currentEntryIdx = tabHistory[details.tabId].currentEntry;
		tabHistory[details.tabId].entries.splice(currentEntryIdx + 1, tabHistory[details.tabId].entries.length - currentEntryIdx + 1);
		tabHistory[details.tabId].entries.push([details.transitionType, details.url]);
		tabHistory[details.tabId].currentEntry++;
		pruneExcessTabHistory(details.tabId);
		tabHistoryModified = true;
	});

    // move data about given tab to closed tabs data when tab is closed
	chrome.tabs.onRemoved.addListener(function(tabID, removeInfo) {
		closedTabHistory.unshift(tabHistory[tabID]);
		delete tabHistory[tabID];

		if(closedTabHistory.length > maxRememberedTabRecords) {
			closedTabHistory.splice(closedTabHistory.length - 1, 1);
		}

		tabHistoryModified = true;
		closedTabHistoryModified = true;
	});

	chrome.tabs.onReplaced.addListener(function(currentID, previousID) {
		tabHistory[currentID] = tabHistory[previousID];
		delete tabHistory[previousID];
		tabHistoryModified = true;
	});
}

// setup all event listeners reporting to the main app about the state about current browsing context(active URL and history of all tabs)
function setupEventListeners() {
	if(!tabsInitialized || !activeTabDataInitialized) {
		window.setTimeout(setupEventListeners, 200);
		return;
	}

	setupURLTracking();
	setupTabHistoryTracking();
    saveTabDataWhenModified();
}

setupNativeMessaging();
loadTabData();
initializeTabData();
setupEventListeners();
