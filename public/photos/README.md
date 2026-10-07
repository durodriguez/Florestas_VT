# Plant photographs

Every photo is **WebP, at most 1200 px on the long edge** — what the field
app writes. Put photos in `public/photos/` with the filename in the `photo`
column, then run `npm run photos` — it lists any photo that is not to the
standard (a JPEG from an older iPhone, a full-size camera shot), and
`npm run photos -- --write` converts them and renames their references in the
data. The tests fail while any photo is another type.

They are served at `<base>photos/<filename>`. A phone that cannot write WebP
(Safari before 17) sends JPEG; the conversion brings it into line.
