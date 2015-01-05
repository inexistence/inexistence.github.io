module Jekyll

  class CategoryPage < Page
    def initialize(site, base, dir, category, index)
      @site = site
      @base = base
      @dir = dir
      @name = "category#{index}.html"

      self.process(@name)
      self.read_yaml(File.join(base, '_layouts'), 'category_index.html')
      self.data['category'] = category

      category_title_prefix = site.config['category_title_prefix'] || 'Category: '
      self.data['title'] = "#{category_title_prefix}#{category}"
    end
  end

  class CategoryPageGenerator < Generator
    safe true

    def generate(site)
      if site.layouts.key? 'category_index'
        dir = site.config['category_dir'] || 'categories'
        site.categories.keys.each_index  do |i|
          site.pages << CategoryPage.new(site, site.source, dir, "#{site.categories.keys[i]}",i)
        end
      end
    end
  end

end