#!/usr/bin/env python3
# ONE-OFF MIGRATION, retained for provenance.
#
# This is how the 129 species in UVM's 2014 tree inventory were merged into
# data/taxa.csv. It is not part of the build and does not need to run again —
# it is kept because the family, habit and Vermont-origin assignments below are
# editorial judgements that deserve review, and they are far easier to check
# here than in a 136-row CSV diff.
#
# Usage (the inventory CSV is not committed; supply your own copy):
#   python3 scripts/one-off/merge-2014-inventory.py UVM_2014_Inventory.csv data/taxa.csv
#
# Re-running is safe: rows already present in taxa.csv are skipped, not
# duplicated.
"""Merge the 2014 UVM tree inventory's species list into data/taxa.csv.

Existing rows are preserved verbatim (they carry hand-written descriptions and
are referenced by the demo plants). Inventory species not already present are
appended. Only facts that are stable and checkable are asserted; horticultural
detail is left blank rather than invented.
"""
import csv, sys, re

INVENTORY, TAXA = sys.argv[1], sys.argv[2]

FAMILY = {
    'Abies': 'Pinaceae', 'Acer': 'Sapindaceae', 'Aesculus': 'Sapindaceae',
    'Amelanchier': 'Rosaceae', 'Aralia': 'Araliaceae', 'Betula': 'Betulaceae',
    'Callitropsis': 'Cupressaceae', 'Carpinus': 'Betulaceae', 'Carya': 'Juglandaceae',
    'Catalpa': 'Bignoniaceae', 'Celtis': 'Cannabaceae', 'Cercidiphyllum': 'Cercidiphyllaceae',
    'Cercis': 'Fabaceae', 'Chamaecyparis': 'Cupressaceae', 'Cladrastis': 'Fabaceae',
    'Cornus': 'Cornaceae', 'Corylus': 'Betulaceae', 'Cotinus': 'Anacardiaceae',
    'Crataegus': 'Rosaceae', 'Diospyros': 'Ebenaceae', 'Elaeagnus': 'Elaeagnaceae',
    'Fagus': 'Fagaceae', 'Fraxinus': 'Oleaceae', 'Ginkgo': 'Ginkgoaceae',
    'Gleditsia': 'Fabaceae', 'Gymnocladus': 'Fabaceae', 'Halesia': 'Styracaceae',
    'Juglans': 'Juglandaceae', 'Juniperus': 'Cupressaceae', 'Larix': 'Pinaceae',
    'Liquidambar': 'Altingiaceae', 'Liriodendron': 'Magnoliaceae', 'Maackia': 'Fabaceae',
    'Magnolia': 'Magnoliaceae', 'Malus': 'Rosaceae', 'Metasequoia': 'Cupressaceae',
    'Morus': 'Moraceae', 'Nyssa': 'Nyssaceae', 'Ostrya': 'Betulaceae',
    'Picea': 'Pinaceae', 'Pinus': 'Pinaceae', 'Platanus': 'Platanaceae',
    'Populus': 'Salicaceae', 'Prunus': 'Rosaceae', 'Pseudotsuga': 'Pinaceae',
    'Ptelea': 'Rutaceae', 'Pyrus': 'Rosaceae', 'Quercus': 'Fagaceae',
    'Rhamnus': 'Rhamnaceae', 'Robinia': 'Fabaceae', 'Salix': 'Salicaceae',
    'Sassafras': 'Lauraceae', 'Sorbus': 'Rosaceae', 'Stewartia': 'Theaceae',
    'Syringa': 'Oleaceae', 'Taxodium': 'Cupressaceae', 'Thuja': 'Cupressaceae',
    'Tilia': 'Malvaceae', 'Tsuga': 'Pinaceae', 'Ulmus': 'Ulmaceae', 'Zelkova': 'Ulmaceae',
}

CONIFER_GENERA = {'Abies', 'Callitropsis', 'Chamaecyparis', 'Juniperus', 'Larix',
                  'Metasequoia', 'Picea', 'Pinus', 'Pseudotsuga', 'Taxodium', 'Thuja', 'Tsuga'}
# Conifers that drop their needles, and the one broadleaf evergreen here.
DECIDUOUS_CONIFERS = {'Larix decidua', 'Larix laricina', 'Metasequoia glyptostroboides',
                      'Taxodium distichum'}
BROADLEAF_EVERGREEN = {'Magnolia grandiflora'}

# Native to Vermont. Restricted to species unambiguously part of the Vermont
# flora — marginal or range-edge cases are deliberately left blank below.
VT_NATIVE = {
    'Abies balsamea', 'Acer negundo', 'Acer rubrum', 'Acer saccharinum', 'Acer saccharum',
    'Amelanchier sp', 'Betula alleghaniensis', 'Betula papyrifera', 'Betula populifolia',
    'Carpinus caroliniana', 'Carya glabra', 'Celtis occidentalis', 'Crataegus sp',
    'Fagus grandifolia', 'Fraxinus americana', 'Fraxinus pennsylvanica', 'Juglans nigra',
    'Juniperus virginiana', 'Larix laricina', 'Nyssa sylvatica', 'Ostrya virginiana',
    'Picea glauca', 'Pinus resinosa', 'Pinus strobus', 'Populus balsamifera',
    'Populus deltoides', 'Prunus pennsylvanica', 'Quercus alba', 'Quercus bicolor',
    'Quercus macrocarpa', 'Quercus rubra', 'Quercus velutina', 'Salix sp',
    'Thuja occidentalis', 'Tilia americana', 'Tsuga canadensis', 'Ulmus americana',
    'Picea sp', 'Ulmus sp', 'Prunus sp',
}
# Recognised as invasive in Vermont. Kept deliberately short — see the summary.
VT_INVASIVE = {'Rhamnus cathartica', 'Elaeagnus angustifolia', 'Acer platanoides'}
# Range-edge in Vermont, or otherwise a call this project should not guess at.
UNCERTAIN_ORIGIN = {
    'Betula lenta', 'Cornus florida', 'Quercus coccinea', 'Quercus muehlenbergii',
    'Quercus palustris', 'Quercus prinus', 'Sassafras albidum', 'Juniperus sp', 'Thuja sp',
}

# Corrections to common names in the 2014 inventory, kept explicit so the
# departure from the source is visible and reviewable.
COMMON_NAME_FIX = {
    # The inventory labels both Carpinus caroliniana and Ostrya virginiana
    # "Hornbeam-American". Only Carpinus is American hornbeam; Ostrya is
    # eastern hophornbeam, also called ironwood.
    'Ostrya virginiana': 'Eastern hophornbeam',
}

def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')

def common_name(raw):
    """Inventory writes 'Maple-Silver'; people say 'Silver maple'.

    The file is not perfectly consistent: one entry ('Russian-olive') is already
    in natural order, and one ('Oak - Scarlet') pads the hyphen with spaces.
    """
    raw = re.sub(r'\s*-\s*', '-', raw.strip())
    if '-' not in raw:
        return raw[:1].upper() + raw[1:]
    group, modifier = (part.strip() for part in raw.split('-', 1))
    # A lowercase second word means the name already reads correctly and the
    # first word is the modifier, not the group.
    if modifier[:1].islower():
        return f"{group[:1].upper()}{group[1:]} {modifier}"
    return f"{modifier[:1].upper()}{modifier[1:]} {group.lower()}"

# ---- read what already exists -------------------------------------------
with open(TAXA, newline='') as f:
    reader = csv.DictReader(f)
    header = reader.fieldnames
    existing = list(reader)
have_sci = {r['scientific_name'].strip() for r in existing}
have_id = {r['taxon_id'].strip() for r in existing}

# ---- read the inventory --------------------------------------------------
with open(INVENTORY, newline='') as f:
    inv = list(csv.DictReader(f))

seen, new_rows = {}, []
for r in inv:
    bot, genus, sp = r['Botanical'].strip(), r['Genus'].strip(), r['Species'].strip()
    cn = r['Common_Name'].strip()
    # 'Crimson King Maple' is Acer platanoides 'Crimson King' recorded without a
    # cultivar column. Keep it as its own taxon so the distinction survives.
    key = (bot, 'Crimson King') if cn == 'Crimson King Maple' else (bot, '')
    seen.setdefault(key, cn)

for (bot, cultivar), cn in sorted(seen.items()):
    genus = bot.split()[0]
    species = bot[len(genus):].strip()
    genus_only = species in ('sp', 'sp.')
    if genus_only:
        species = ''
    sci = f"{bot} '{cultivar}'" if cultivar else (f"{genus} sp." if genus_only else bot)
    if sci in have_sci:
        continue
    tid = slug(f"{bot}-{cultivar}" if cultivar else bot)
    if tid in have_id:
        continue
    have_id.add(tid)

    conifer = genus in CONIFER_GENERA
    if bot in DECIDUOUS_CONIFERS:
        foliage = 'deciduous'
    elif conifer or bot in BROADLEAF_EVERGREEN:
        foliage = 'evergreen'
    else:
        foliage = 'deciduous'

    if bot in VT_INVASIVE:
        native = 'invasive'
    elif bot in VT_NATIVE:
        native = 'native'
    elif bot in UNCERTAIN_ORIGIN:
        native = ''
    else:
        native = 'introduced'

    new_rows.append({
        'taxon_id': tid,
        'scientific_name': sci,
        'common_name': COMMON_NAME_FIX.get(bot) or common_name(cn),
        'family': FAMILY.get(genus, ''),
        'genus': genus,
        'species': species,
        'infraspecific': '',
        'cultivar': cultivar,
        'habit': 'conifer' if conifer else 'tree',
        'foliage': foliage,
        'native_status': native,
        # Phenology, colour, size and prose are left blank on purpose: they are
        # not in the inventory and are not worth inventing.
        'flower_color': '', 'flower_months': '', 'fruit_color': '', 'fruit_months': '',
        'fall_color': '', 'mature_height_ft': '', 'hardiness_zones': '',
        'wikipedia_url': '', 'description': '',
    })

missing_family = [r['taxon_id'] for r in new_rows if not r['family']]
if missing_family:
    sys.exit(f"no family mapped for: {missing_family}")

allrows = existing + new_rows
allrows.sort(key=lambda r: (r['genus'].strip().lower(), r['scientific_name'].strip().lower()))

with open(TAXA, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=header, quoting=csv.QUOTE_MINIMAL)
    w.writeheader()
    w.writerows(allrows)

print(f"kept {len(existing)} existing, added {len(new_rows)}, total {len(allrows)}")
print(f"blank native_status (range-edge, left for review): "
      f"{sorted(r['taxon_id'] for r in new_rows if not r['native_status'])}")
