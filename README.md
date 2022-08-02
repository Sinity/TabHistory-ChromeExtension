# TabHistory-ChromeExtension

Repo zawiera rozszerzenie do Google Chrome które ma na celu śledzić w jaki sposób użytkownik dotarł do określonego URL na danym tabie. Biorąc przykład z komentarza w kodzie:

```js
// Maps tab ID's to tab records.
// Each tab record is composed of array of URL entries and index in this array indicating which URL entry is current URL entry of a given tab
// URL entry is a two-element array, where first element is transition type(how user got there) and second is URL itself
// Example tab record: tabHistory[123] = {currentEntry: 1, entries: [["typed", "google.com"], ["link", "youtube.com"]]};
var tabHistory = {};
```

Oznacza to iż użytkownik był na pustym tabie, następnie wszedł na nim na google.com poprzez wpisanie adresu, a następnie z tamtej strony kliknął na link prowadzący do youtube.com.
Jeśli użytkownik następnie cofnąłby się wstecz, currentEntry ustawiony byłoby na 0 (co oznacza znów google.com).

Kod znajduje się w extension/background.js - reszta repo to szkielet komunikacji IPC z daemonem który miał komunikować się z aplikacją desktopową
służącą do śledzenia/analizy czasu jaki użytkownik spędził w danych miejscach w sieci - jednak ta nie została wykonana.


------
------


Rozszerzenie niekoniecznie w tej chwili jest sprawne - było ono pisane w 2016, możliwe że od tego czasu były zmiany w API i/lub funkcjonowaniu przeglądarki które je psują.
