Feature Content Guard Summary
- total_pages: 11
- passed_pages: 9
- failed_pages: 2
- reliability_percent: 81.82
- total_failures: 3
- valid: false
- rule_failures:
  - structure: 1
  - keyword_owner: 2
  - title_h1_similarity: 0
  - semantic_overlap: 0
  - cluster_boundary: 0
  - differentiation_block: 0
  - link_budget: 0
  - uniqueness: 0
  - source_drift: 0
- violations:
  - [keyword_owner] /features/sales/sales: primary_keyword 'satis yonetimi' is owned by multiple pages.
    details: {"conflicting_routes":["/features/sales/sales","/features/inventory/inventory"]}
  - [keyword_owner] /features/inventory/inventory: primary_keyword 'satis yonetimi' is owned by multiple pages.
    details: {"conflicting_routes":["/features/sales/sales","/features/inventory/inventory"]}
  - [structure] /features/inventory/inventory: TR locale page metadata does not align with primary keyword tokens.
    details: {"primary_keyword":"satis yonetimi","h1":"Kritik Stok Kontrolu","meta_title":"Kritik Stok ve Envanter Kontrolu | LoomaPOS"}
