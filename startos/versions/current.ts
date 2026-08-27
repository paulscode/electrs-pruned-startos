import { VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.11.1:24',
  releaseNotes: {
    en_US: `The service is now called **Electrs Pruned**, and its package identifier is \`electrs-pruned\`.

It was previously Pruned Electrs, which was the only name in this family ordered that way: the companions are Electrs Liquid, Mempool BIP-110, Bitcoin Knots BLAKE2b. Putting the application first sorts them together and leaves room for the Mempool companion that follows. Nothing about how the service works has changed.

The identifier is part of a package's identity in StartOS, so this is a new package rather than a rename it can carry across. An installation of the old one does not update to this: it has to be removed and this one installed, and the address index rebuilds. That is the whole cost of the change, and it is why it was made now, before any release, rather than later when it would strand anyone who had installed it.`,
    es_ES: `El servicio ahora se llama **Electrs Pruned**, y su identificador de paquete es \`electrs-pruned\`.

Antes era Pruned Electrs, el único nombre de esta familia ordenado así: sus compañeros son Electrs Liquid, Mempool BIP-110, Bitcoin Knots BLAKE2b. Poner la aplicación primero los agrupa al ordenarlos y deja sitio para el compañero de Mempool que viene después. No ha cambiado nada en el funcionamiento del servicio.

El identificador forma parte de la identidad de un paquete en StartOS, así que esto es un paquete nuevo y no un cambio de nombre que pueda arrastrar consigo. Una instalación del anterior no se actualiza a esta: hay que quitarla e instalar esta, y el índice de direcciones se reconstruye. Ese es todo el coste del cambio, y por eso se ha hecho ahora, antes de cualquier publicación, y no más tarde, cuando dejaría tirado a quien lo tuviera instalado.`,
    de_DE: `Der Dienst heißt jetzt **Electrs Pruned**, und seine Paketkennung ist \`electrs-pruned\`.

Vorher hieß er Pruned Electrs und war der einzige Name in dieser Familie in dieser Reihenfolge: die Geschwister sind Electrs Liquid, Mempool BIP-110, Bitcoin Knots BLAKE2b. Die Anwendung vorne sortiert sie zusammen und lässt Platz für den Mempool-Begleiter, der folgt. An der Funktionsweise des Dienstes ändert sich nichts.

Die Kennung gehört in StartOS zur Identität eines Pakets, also ist dies ein neues Paket und keine Umbenennung, die es mitnehmen kann. Eine Installation des alten aktualisiert sich nicht hierauf: sie muss entfernt und diese installiert werden, und der Adressindex wird neu aufgebaut. Das sind die gesamten Kosten der Änderung, und deshalb wurde sie jetzt gemacht, vor jeder Veröffentlichung, statt später, wo sie alle Installierten hängen lassen würde.`,
    pl_PL: `Usługa nazywa się teraz **Electrs Pruned**, a jej identyfikator pakietu to \`electrs-pruned\`.

Wcześniej było to Pruned Electrs, jedyna nazwa w tej rodzinie ułożona w tej kolejności: pozostałe to Electrs Liquid, Mempool BIP-110, Bitcoin Knots BLAKE2b. Aplikacja na początku grupuje je przy sortowaniu i zostawia miejsce dla towarzysza Mempool, który dopiero powstanie. W działaniu usługi nic się nie zmieniło.

Identyfikator jest w StartOS częścią tożsamości pakietu, więc jest to nowy pakiet, a nie zmiana nazwy, którą dałoby się przenieść. Instalacja poprzedniego nie zaktualizuje się do tego: trzeba ją usunąć i zainstalować ten, a indeks adresów zostanie zbudowany od nowa. To jest cały koszt tej zmiany i dlatego zrobiono ją teraz, przed jakimkolwiek wydaniem, a nie później, gdy zostawiłaby na lodzie każdego, kto ma ją zainstalowaną.`,
    fr_FR: `Le service s'appelle désormais **Electrs Pruned**, et son identifiant de paquet est \`electrs-pruned\`.

Il s'appelait Pruned Electrs, le seul nom de cette famille dans cet ordre : ses voisins sont Electrs Liquid, Mempool BIP-110, Bitcoin Knots BLAKE2b. Mettre l'application en premier les regroupe au tri et laisse la place au compagnon Mempool qui suivra. Rien n'a changé au fonctionnement du service.

L'identifiant fait partie de l'identité d'un paquet dans StartOS : il s'agit donc d'un nouveau paquet et non d'un renommage qu'il pourrait emporter avec lui. Une installation de l'ancien ne se met pas à jour vers celui-ci : il faut la supprimer et installer celui-ci, et l'index d'adresses se reconstruit. C'est tout le coût de ce changement, et c'est pourquoi il a été fait maintenant, avant toute publication, plutôt que plus tard, où il laisserait en plan quiconque l'aurait installé.`,
  },
  migrations: {},
})
