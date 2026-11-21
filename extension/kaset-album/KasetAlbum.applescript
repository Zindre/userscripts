-- Kaset Album: plays a whole album in Kaset (the YouTube Music app for the Mac) from a link.
-- Web Detox's Kaset button opens kasetalbum://play?v=ID1,ID2,…; this hands the song IDs to Kaset's own
-- AppleScript command, which replaces Kaset's queue with them and starts playing, and quits. Nothing stays running.
-- Kaset's own kaset:// links can only start one song, so this small go-between is needed for a whole album.

on open location theURL
	set AppleScript's text item delimiters to "v="
	if (count of text items of theURL) < 2 then
		set AppleScript's text item delimiters to ""
		return
	end if
	set idText to text item 2 of theURL
	set AppleScript's text item delimiters to ","
	set parts to text items of idText
	set AppleScript's text item delimiters to ""
	set ids to {}
	repeat with p in parts
		set s to p as text
		if my isVideoId(s) then set end of ids to s
		if (count of ids) is 200 then exit repeat
	end repeat
	if ids is {} then return
	tell application "Kaset"
		activate
		play videos ids
	end tell
end open location

-- A YouTube video ID: 11 letters, digits, - or _. Anything else in the link is ignored.
on isVideoId(s)
	if length of s is not 11 then return false
	considering case
		repeat with c in characters of s
			if "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-" does not contain (c as text) then return false
		end repeat
	end considering
	return true
end isVideoId
