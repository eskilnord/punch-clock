# Stämpelklocka

En enkel webbaserad stämpelklocka som körs helt i webbläsaren utan behov av server.

## Funktioner

- **Medarbetargränssnitt:** Stämpla in och ut med personnummer
- **Administratörsgränssnitt:** Hantera medarbetare, generera rapporter och ändra inställningar
- **Lokal lagring:** All data sparas lokalt i webbläsaren med IndexedDB
- **Mobilvänlig:** Fungerar på alla moderna enheter

## Kom igång

### Installation

Ingen installation behövs! Öppna bara `index.html` i en modern webbläsare.

### Första användning

1. Vid första användning kommer du att behöva skapa en PIN-kod för administratörsgränssnittet
2. Efter att PIN-koden är skapad kommer du att se administratörspanelen där du kan lägga till medarbetare
3. Lägg till dina medarbetare med personnummer (format: ÅÅÅÅMMDD-XXXX)
4. Logga ut från adminpanelen genom att klicka på "Logga ut"

### Använda stämpelklockan

#### För medarbetare:

1. Ange ditt personnummer i det angivna fältet
2. Klicka på "Fortsätt"
3. Klicka på "Stämpla in" eller "Stämpla ut" beroende på vad som visas

#### För administratörer:

1. Klicka på "Admin" länken i övre högra hörnet
2. Ange din PIN-kod
3. Använd flikarna för att:
   - Hantera medarbetare (lägg till/ta bort)
   - Generera rapporter (närvarorapport eller timsammanställning)
   - Ändra inställningar (rensa all data)

## Rapporter

Systemet kan generera två typer av rapporter:

1. **Närvarorapport:** Visar alla in- och utstämplingar för alla medarbetare
2. **Arbetstidssammanställning:** Summerar totala arbetstimmar per medarbetare för en vald period

Rapporterna laddas ner som PDF-filer.

## Tekniska detaljer

- Byggt med HTML, CSS (Tailwind) och JavaScript (React)
- Alla data lagras lokalt med IndexedDB
- Kräver ingen server eller molnlagring
- Pin-kod hashas med SHA-256 för säkerhet

## Felsökning

- **Webbläsarstöd:** Applikationen kräver en modern webbläsare. Om du har problem, försök uppdatera din webbläsare.
- **Datalagring:** Om appen inte fungerar som förväntat, försök rensa webbläsarens cache och lokala lagring.

## Licens

Fri att använda för alla. 