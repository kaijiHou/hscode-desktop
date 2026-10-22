# Browser bookmarks contract

`BookmarkPort` is the read and command boundary for browser bookmarks. URL normalization permits
only absolute HTTP and HTTPS URLs without embedded credentials. It follows the URL standard while
preserving fragments and meaningful path slashes. Sensitive query values are never stripped; the
caller must obtain explicit consent before saving such a URL. Main enforces the shared 200-character
title, 8192-character URL, and 128-character ID limits on both commands and stored data.
