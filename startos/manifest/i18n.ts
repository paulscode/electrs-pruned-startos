// What electrs takes from the node. Was upstream's "Used to subscribe to new block events",
// which named the least of it. electrs 0.11 reads headers and blocks over P2P (where new-block
// notices also arrive), and everything else over RPC, including the blocks below the prune
// height, which the node's RPC proxy fetches from peers.
export const bitcoindDescription = {
  en_US:
    'Provides headers and blocks over P2P, and the mempool, fee estimates, transaction broadcast and pruned blocks over RPC.',
  es_ES:
    'Proporciona cabeceras y bloques mediante P2P, y el mempool, las estimaciones de comisiones, la difusión de transacciones y los bloques podados mediante RPC.',
  de_DE:
    'Stellt Header und Blöcke über P2P sowie Mempool, Gebührenschätzungen, das Senden von Transaktionen und geprunte Blöcke über RPC bereit.',
  pl_PL:
    'Udostępnia nagłówki i bloki przez P2P, a mempool, szacunki opłat, rozgłaszanie transakcji i przycięte bloki przez RPC.',
  fr_FR:
    'Fournit les en-têtes et les blocs via P2P, ainsi que le mempool, les estimations de frais, la diffusion des transactions et les blocs élagués via RPC.',
}

export const short = {
  en_US:
    'An efficient re-implementation of Electrum Server in Rust, for pruned Bitcoin nodes',
  es_ES: 'Una reimplementación eficiente del servidor Electrum en Rust',
  de_DE: 'Eine effiziente Neuimplementierung des Electrum-Servers in Rust',
  pl_PL: 'Wydajna reimplementacja serwera Electrum w Rust',
  fr_FR: 'Une réimplémentation efficace du serveur Electrum en Rust',
}

export const long = {
  en_US:
    'Enables a user to self host an Electrum server without keeping a full copy of the blockchain, so Bitcoin may stay pruned. Blocks that Bitcoin has already discarded are fetched on demand through the RPC proxy that the Bitcoin service runs whenever pruning is enabled. The server indexes the entire Bitcoin blockchain, and the resulting index enables fast queries for any given user wallet, allowing the user to keep real-time track of balances and transaction history using the Electrum wallet. Since it runs on the users own machine, there is no need for the wallet to communicate with external Electrum servers, thus preserving the privacy of the users addresses and balances.',
  es_ES:
    'Permite al usuario alojar su propio servidor Electrum, con recursos de hardware no mucho más allá de los de un nodo completo. El servidor indexa toda la cadena de bloques de Bitcoin, y el índice resultante permite consultas rápidas para cualquier billetera de usuario, permitiendo al usuario mantener un seguimiento en tiempo real de saldos e historial de transacciones usando la billetera Electrum. Al ejecutarse en la propia máquina del usuario, no es necesario que la billetera se comunique con servidores Electrum externos, preservando así la privacidad de las direcciones y saldos del usuario.',
  de_DE:
    'Ermöglicht es einem Benutzer, einen Electrum-Server selbst zu hosten, mit Hardwareanforderungen, die nicht viel über die eines vollständigen Knotens hinausgehen. Der Server indiziert die gesamte Bitcoin-Blockchain, und der resultierende Index ermöglicht schnelle Abfragen für jede Benutzer-Wallet, sodass der Benutzer Salden und Transaktionshistorie in Echtzeit mit der Electrum-Wallet verfolgen kann. Da er auf der eigenen Maschine des Benutzers läuft, muss die Wallet nicht mit externen Electrum-Servern kommunizieren, wodurch die Privatsphäre der Adressen und Salden des Benutzers gewahrt bleibt.',
  pl_PL:
    'Umożliwia użytkownikowi samodzielne hostowanie serwera Electrum, z wymaganiami sprzętowymi niewiele przekraczającymi te dla pełnego węzła. Serwer indeksuje cały blockchain Bitcoin, a wynikowy indeks umożliwia szybkie zapytania dla dowolnego portfela użytkownika, pozwalając na śledzenie sald i historii transakcji w czasie rzeczywistym za pomocą portfela Electrum. Ponieważ działa na własnej maszynie użytkownika, portfel nie musi komunikować się z zewnętrznymi serwerami Electrum, chroniąc tym samym prywatność adresów i sald użytkownika.',
  fr_FR:
    "Permet à un utilisateur d'auto-héberger un serveur Electrum, avec des ressources matérielles à peine supérieures à celles d'un nœud complet. Le serveur indexe l'intégralité de la blockchain Bitcoin, et l'index résultant permet des requêtes rapides pour tout portefeuille utilisateur, permettant à l'utilisateur de suivre en temps réel les soldes et l'historique des transactions avec le portefeuille Electrum. Puisqu'il s'exécute sur la propre machine de l'utilisateur, il n'est pas nécessaire que le portefeuille communique avec des serveurs Electrum externes, préservant ainsi la confidentialité des adresses et des soldes de l'utilisateur.",
}
