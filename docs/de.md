# Immich-Diashow für Gladys

## Zweck

Diese externe Gladys-Integration macht aus einem oder mehreren **Immich-Alben** oder der Sammlung **Erinnerungen — an diesem Tag** eine virtuelle Kamera. Fügen Sie diese Kamera dem Gladys-Dashboard hinzu, um eine automatisch wechselnde Foto-Diashow anzuzeigen. Die Fotos bleiben auf dem konfigurierten Immich-Server: Die Integration ruft nur die Vorschaubilder von Immich ab und lädt nie die Originale herunter.

Die Integration erfordert Gladys **5.3.0 oder neuer**. Jede Diashow ist eine virtuelle Kamera, die in einer Kamera-Box des Dashboards verwendet werden kann. Die Integration fügt außerdem ein **Dashboard-Widget „Immich-Foto“** und eine **Szenenaktion** hinzu, die das nächste Foto anzeigt. Sie ist auf Englisch, Französisch, Deutsch und Spanisch verfügbar.

## Voraussetzungen

Sie benötigen einen erreichbaren Immich-Server und einen API-Schlüssel, erstellt unter **Immich → Kontoeinstellungen → API-Schlüssel**. Geben Sie dem Schlüssel nur die folgenden Berechtigungen:

| Berechtigung  | Wofür sie benötigt wird                                      |
| ------------- | ------------------------------------------------------------ |
| `album.read`  | Listet die Alben auf und liest das gewählte Album.           |
| `asset.read`  | Sucht die Medien des gewählten Albums.                       |
| `asset.view`  | Lädt ein Vorschaubild für die Dashboard-Kamera herunter.     |
| `memory.read` | Liest die optionale Quelle der Erinnerungen „an diesem Tag“. |

Der Gladys-Container muss die im Konfigurationsformular eingegebene URL erreichen können. Für einen Server in Ihrem lokalen Netzwerk verwenden Sie seine LAN-Adresse und den Immich-Port, zum Beispiel `http://192.168.1.20:2283`. Verwenden Sie nicht `localhost`: Das bezeichnet den isolierten Container der Integration, nicht den Gladys-Host oder den Immich-Server.

## Einrichtung

Öffnen Sie **Integrationen → Immich Slideshow → Konfiguration** und geben Sie die Server-URL und den API-Schlüssel für **Diashow 1** ein. Wählen Sie **Album** oder **Erinnerungen — an diesem Tag**. Für ein oder mehrere Alben klicken Sie nach Eingabe von Server-URL und API-Schlüssel auf **Immich-Alben auflisten**. Die Aktion liefert für jedes Album Name, UUID und Anzahl der Medien; tragen Sie eine oder mehrere UUIDs in **Album-UUIDs** ein, getrennt durch Kommas oder Zeilenumbrüche. Die Integration führt die Alben zusammen, entfernt doppelte Fotos und wendet die Bildobergrenze auf die gesamte Quelle an. Die Taste **Immich-Verbindung testen** bestätigt, dass Gladys mit dem konfigurierten Schlüssel die Alben auflisten kann.

Wählen Sie das Bildwechsel-Intervall, wie oft die Quellliste aktualisiert wird, und die maximale Anzahl zu behaltender Bilder. Aktivieren Sie **Immich-Bildunterschrift anzeigen**, um die vorhandene Immich-Beschreibung, den Ort und das Aufnahmedatum in einem gut lesbaren Band am unteren Rand jedes Bildes einzufügen. **Sprache der Bildunterschrift** legt die Sprache des Datums in diesem Band (Englisch, Französisch, Deutsch oder Spanisch) und des Quellnamens fest, den die Szenenaktion liefert; das Dashboard-Widget verwendet immer die Sprache des jeweiligen Betrachters. Die Aktualisierung der Quelle ist bewusst vom Bildwechsel-Intervall getrennt: Ein großes Album wird nur periodisch abgefragt, und einzelne Vorschaubilder werden erst beim Anzeigen heruntergeladen. Videos werden ausgeschlossen. Standardmäßig erscheinen die neuesten Bilder zuerst; aktivieren Sie die zufällige Reihenfolge, um jede neu geladene Liste zu mischen.

Speichern Sie die Konfiguration, öffnen Sie den Reiter **Erkennung** der Integration und erstellen Sie die Kamera **Immich slideshow**. Sie können auch **Immich slideshow 2** erstellen: Ihr Profil ist völlig unabhängig und kann ein anderes Album, die Erinnerungen, andere Intervalle, eine andere Bildunterschrift-Einstellung oder sogar einen anderen Immich-Server verwenden. Füllen Sie die Felder von **Diashow 2** aus, bevor Sie diese zweite Kamera erstellen, und verwenden Sie dann ihre eigenen Tasten für Verbindungstest, Albenliste und Aktualisierung. Fügen Sie jede Kamera einer Kamera-Box auf dem Gladys-Dashboard Ihrer Wahl hinzu, sodass die erste Kamera auf einem Dashboard und die zweite auf einem anderen verwendet werden kann. Jedes erste Bild wird sofort veröffentlicht, danach aktualisiert sich jede Kamera in ihrem eigenen Intervall.

## Verbindungsstatus und Transport-Badge

Der Reiter **Konfiguration** zeigt einen Verbindungsstatus für die Integration: Er wird rot, sobald eine konfigurierte Diashow fehlschlägt, mit dem Grund (Server nicht erreichbar, Schlüssel abgelehnt, leere Quelle …), und wird von selbst wieder grün, sobald die Diashow wieder funktioniert. Ein erfolgreicher Klick auf **Testen** oder **Aktualisieren** löscht ebenfalls einen veralteten Fehler.

Jede Kamera trägt außerdem ein Transport-Badge. Es zeigt **local**, wenn die Immich-URL auf Ihr Heimnetz zeigt (eine private Adresse wie `192.168.x.x`, ein Name auf `.local`, `.lan` oder `.home.arpa`, ein kurzer Containername, eine Tailscale-Adresse), **cloud**, wenn sie über das Internet läuft (öffentlicher Domainname, Reverse Proxy, Tunnel), und **unreachable**, wenn Immich nicht antwortet. Ein orangefarbener Punkt bedeutet, dass Immich antwortet, die Diashow aber nicht laufen kann: Fahren Sie mit der Maus über das Badge, um den Grund zu lesen. Da jede Diashow genau eine Immich-URL hat, hat der Schalter **Lokale Verbindung bevorzugen** im Konfigurationsbildschirm keine Wirkung: Um lokal zu verbinden, geben Sie die lokale Netzwerkadresse Ihres Servers ein.

## Datenschutz und Bildverarbeitung

Der API-Schlüssel ist als Gladys-`secret` deklariert: Er wird sicher gespeichert und nie an den Dashboard-Browser zurückgegeben. Die Anfragen an Immich enthalten den Header `x-api-key` innerhalb des Integrationscontainers. Die Vorschaubilder werden korrekt ausgerichtet, verkleinert und als JPEG komprimiert, bevor sie über den Kamerakanal von Gladys gesendet werden; so bleibt das Dashboard flüssig und die Größengrenze des Kanals wird eingehalten. Wenn aktiviert, werden die gewählten Immich-Metadaten in ein kontrastreiches Band am unteren Rand der Vorschau eingefügt und reisen daher mit dem Kamerabild zum Dashboard.

## Fehlerbehebung

Meldet der Verbindungstest einen ungültigen Schlüssel oder fehlende Berechtigungen, erstellen Sie einen neuen Immich-API-Schlüssel mit den vier oben genannten Berechtigungen. Wird ein Album als leer gemeldet, obwohl es Fotos enthält, aktualisieren Sie auf diese Version: Neuere Immich-Versionen liefern die Album-Metadaten getrennt von den Medien, die die Integration nun über die nach Album gefilterte Metadaten-Suche abruft. Ist der Server nicht erreichbar, prüfen Sie die URL aus dem Netzwerk des Gladys-Hosts und stellen Sie sicher, dass weder ein Reverse Proxy noch eine Firewall oder ein Docker-Netzwerk den Container der externen Integration daran hindert, Immich zu erreichen. Ein leeres Album oder eine leere Erinnerungssammlung ist ein normaler Zustand; fügen Sie Fotos hinzu oder wählen Sie eine andere Quelle. Das Protokoll der Integration im Reiter Konfiguration von Gladys enthält die Fehlerkategorie auf HTTP-Ebene, ohne Ihren API-Schlüssel preiszugeben.

## Widget „Immich-Foto“

Fügen Sie beim Bearbeiten des Dashboards das Widget **Immich-Foto** hinzu und wählen Sie in seinen Einstellungen die zu verfolgende Diashow-Kamera (die Kamera muss im Reiter **Erkennung** erstellt worden sein). Das Widget zeigt das aktuelle Foto, seine Bildunterschrift, wenn die eingefügte Bildunterschrift deaktiviert ist, den Status der Diashow, wie der Immich-Server erreicht wird (lokal oder Cloud), die Quelle und die Anzahl der Fotos. Die Taste **Nächstes Foto** schaltet die Kamera sofort weiter; **Aktualisieren** liest das Album oder die heutigen Erinnerungen erneut. Das Widget folgt der Kamera: Es aktualisiert sich bei jedem neuen Foto. Wenn etwas schiefgeht, zeigt es statt des Fotos den Grund an.

## Szenenaktion „Nächstes Immich-Foto anzeigen“

In einer Szene schaltet die Aktion **Nächstes Immich-Foto anzeigen** die gewählte Kamera weiter und liest auf Wunsch zuerst die Quelle neu. Sie liefert drei Variablen für die folgenden Aktionen: **Foto angezeigt** (wahr oder falsch), **Dateiname des Fotos** und **Album oder Erinnerungen**. Eine nicht konfigurierte oder fehlerhafte Diashow lässt die Szene nicht fehlschlagen: **Foto angezeigt** ist dann falsch, sodass der Rest der Szene davon abhängen kann.

Beispiel: Jeden Morgen um 8 Uhr das nächste Foto der heutigen Erinnerungen anzeigen und es dann, wenn **Foto angezeigt** wahr ist, mit der eingebauten Aktion **Kamerabild senden** in einer Nachricht verschicken.

## Referenzen

[1] [Immich-API-Endpunkte](https://api.immich.app/endpoints)
[2] [Externe Gladys-Integrationen](https://gladysassistant.com/docs/dev/external-integrations/)
