import { VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.11.1:23',
  releaseNotes: {
    en_US: `Fixes a false "Required health check not passing" warning when the backend is Bitcoin Knots BLAKE2b.

The package asked that backend to be passing health checks named \`bitcoind\` and \`sync-progress\`, which are the names the official Bitcoin service uses. Knots BLAKE2b is a separate service and names its own \`node\` and \`chain\`. StartOS cannot tell a required check that does not exist from one that is failing, so the dependency showed a warning that would never clear no matter how healthy the node was, and could not even say which check it meant. The required names are now correct for each backend. Nothing else changed, and no other backend was affected.`,
    es_ES: `Corrige un aviso falso de «La comprobación de estado requerida no se está superando» cuando el backend es Bitcoin Knots BLAKE2b.

El paquete pedía que ese backend superara comprobaciones llamadas \`bitcoind\` y \`sync-progress\`, que son los nombres que usa el servicio oficial de Bitcoin. Knots BLAKE2b es un servicio aparte y llama a las suyas \`node\` y \`chain\`. StartOS no puede distinguir una comprobación requerida que no existe de una que está fallando, así que la dependencia mostraba un aviso que nunca desaparecería por muy sano que estuviera el nodo, y que ni siquiera podía decir a qué comprobación se refería. Los nombres requeridos ahora son los correctos para cada backend. No ha cambiado nada más, y ningún otro backend estaba afectado.`,
    de_DE: `Behebt eine falsche Warnung „Erforderliche Zustandsprüfung nicht bestanden“, wenn als Backend Bitcoin Knots BLAKE2b gewählt ist.

Das Paket verlangte von diesem Backend Zustandsprüfungen namens \`bitcoind\` und \`sync-progress\`, so heißen sie beim offiziellen Bitcoin-Dienst. Knots BLAKE2b ist ein eigener Dienst und nennt seine \`node\` und \`chain\`. StartOS kann eine geforderte Prüfung, die es nicht gibt, nicht von einer unterscheiden, die fehlschlägt, also zeigte die Abhängigkeit eine Warnung, die nie verschwunden wäre, so gesund der Knoten auch war, und die nicht einmal sagen konnte, welche Prüfung gemeint ist. Die geforderten Namen stimmen jetzt für jedes Backend. Sonst hat sich nichts geändert, und kein anderes Backend war betroffen.`,
    pl_PL: `Naprawia fałszywe ostrzeżenie „Wymagana kontrola stanu nie przechodzi”, gdy backendem jest Bitcoin Knots BLAKE2b.

Pakiet wymagał od tego backendu kontroli o nazwach \`bitcoind\` i \`sync-progress\`, czyli takich, jakich używa oficjalna usługa Bitcoin. Knots BLAKE2b to osobna usługa i swoje nazywa \`node\` oraz \`chain\`. StartOS nie odróżnia wymaganej kontroli, która nie istnieje, od takiej, która zawodzi, więc zależność pokazywała ostrzeżenie, które nigdy by nie zniknęło, niezależnie od tego, jak zdrowy był węzeł, i które nie potrafiło nawet powiedzieć, o którą kontrolę chodzi. Wymagane nazwy są teraz poprawne dla każdego backendu. Nic więcej się nie zmieniło i żaden inny backend nie był dotknięty.`,
    fr_FR: `Corrige un faux avertissement « Vérification d'état requise non satisfaite » lorsque le backend est Bitcoin Knots BLAKE2b.

Le paquet demandait à ce backend de satisfaire des vérifications nommées \`bitcoind\` et \`sync-progress\`, les noms qu'emploie le service Bitcoin officiel. Knots BLAKE2b est un service distinct et nomme les siennes \`node\` et \`chain\`. StartOS ne peut pas distinguer une vérification requise qui n'existe pas d'une qui échoue : la dépendance affichait donc un avertissement qui n'aurait jamais disparu, quelle que soit la santé du nœud, et qui ne pouvait même pas dire de quelle vérification il s'agissait. Les noms requis sont désormais corrects pour chaque backend. Rien d'autre n'a changé, et aucun autre backend n'était concerné.`,
  },
  migrations: {},
})
