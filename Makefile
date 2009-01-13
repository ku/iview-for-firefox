XPIFILE=iview.xpi
SRC=content/iview.js content/iview.html
all:iview.xpi


$(XPIFILE): $(SRC) install.rdf
	zip -r $(XPIFILE) install.rdf chrome.manifest  content/*
	./sign $(XPIFILE) > update.rdf

clean:
	rm update.rdf $(XPIFILE)

upload:
	scp iview.xpi update.rdf ido.nu:www/iview/firefox/
