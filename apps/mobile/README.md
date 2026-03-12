# Mobile

Phase 5 mobile operational core.

Bu uygulama website'in devami degil; licensed tenant kullanicilar icin operational mobile companion olarak calisir.

Aktif kapsam:

- auth + activation aware mobile shell
- branch-aware dashboard
- local product cache, barcode lookup, product create/edit foundation
- stock count draft, resume, submit
- local outbox + pull/push sync preparation
- activity, notifications, diagnostics, logout

Ana dosyalar:

- `lib/screens/home_shell.dart`
- `lib/data/mobile_repository.dart`
- `lib/store/local_store_native.dart`
- `lib/providers/mobile_providers.dart`

Dogrulama:

- `puro flutter analyze`
- `puro flutter test`

Not:

- `puro flutter build apk --debug` bu ortamda `puro.exe` erisim engeli nedeniyle calistirilamadi.
- Backend mobile sync kontrati `apps/api/src/LoomaPos.Api/Endpoints/SyncEndpoints.cs` ve `apps/api/src/LoomaPos.Infrastructure/Sync/SyncEventProcessor.cs` uzerinden genisletildi.
