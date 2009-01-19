<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:em="http://www.mozilla.org/2004/em-rdf#"
  xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
>
  <xsl:output method="xml" encoding="utf-8" indent="yes"/>
  <xsl:template match="/">
<RDF:RDF xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:em="http://www.mozilla.org/2004/em-rdf#">
    <RDF:Description>
			<xsl:attribute name="about"><xsl:value-of select="concat('urn:mozilla:extension:',//RDF:Description[@RDF:about='urn:mozilla:install-manifest']/@em:id)"/></xsl:attribute>
      <em:updates>
        <RDF:Seq>
          <RDF:li>
            <RDF:Description>
              <em:version><xsl:value-of select="//RDF:Description[@RDF:about='urn:mozilla:install-manifest']/@em:version"/></em:version>
              <em:targetApplication>
                <RDF:Description>
                  <em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>
                  <em:minVersion><xsl:value-of select="//RDF:Description/@em:minVersion"/></em:minVersion>
                  <em:maxVersion><xsl:value-of select="//RDF:Description/@em:maxVersion"/></em:maxVersion>
                  <em:updateLink><xsl:value-of select="concat( substring-before(//RDF:Description/@em:updateURL,'update.rdf'), '*')"/></em:updateLink>
									<em:updateHash>*</em:updateHash>
                </RDF:Description>
              </em:targetApplication>
            </RDF:Description>
          </RDF:li>
        </RDF:Seq>
      </em:updates>
      <em:signature>*</em:signature>
    </RDF:Description>
</RDF:RDF>
  </xsl:template> 
</xsl:stylesheet>
