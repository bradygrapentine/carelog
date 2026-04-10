require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'CarelogWatch'
  s.version        = package['version']
  s.summary        = 'Carelog WatchConnectivity bridge for Apple Watch complications'
  s.description    = s.summary
  s.license        = package['license'] || 'MIT'
  s.author         = package['author'] || 'Carelog'
  s.homepage       = 'https://github.com/carelog/carelog'
  s.platforms      = { :ios => '14.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files   = '**/*.{h,m,mm,swift}'
end
