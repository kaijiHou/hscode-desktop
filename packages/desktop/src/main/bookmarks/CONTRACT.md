# Desktop bookmarks

One Main-process `BookmarkService` instance owns the file and serializes all reads and commands.
It reads and writes version 1 snapshots, atomically replaces the file before publishing a new
revision, and keeps malformed or inaccessible data from becoming an empty replacement.
It enforces shared title, URL, and ID length limits when accepting commands and reading disk data.
