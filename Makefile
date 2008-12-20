XPIFILE=iview.xpi
SRC=content/iview.js content/iview.html
all:iview.xpi


$(XPIFILE): $(SRC)
	zip -r $(XPIFILE) install.rdf chrome.manifest  content/*

update.rdf:install.rdf $(XPIFILE)
	./sign $(XPIFILE) > update.rdf

clean:
	rm update.rdf wiiremocom.xpi

