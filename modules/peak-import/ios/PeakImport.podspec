Pod::Spec.new do |s|
  s.name = 'PeakImport'
  s.version = '1.8.10'
  s.summary = 'On-device audio import for Peak Music'
  s.description = 'Local YouTube extraction and audio downloads, with no conversion server.'
  s.license = { :type => 'MIT', :file => 'YouTubeKit/LICENSE' }
  s.author = 'Peak Music'
  s.homepage = 'https://github.com/alexeichhorn/YouTubeKit'
  s.platforms = { :ios => '16.0' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
  s.frameworks = 'AVFoundation', 'JavaScriptCore', 'Speech'
  s.resource_bundles = { 'PeakImportResources' => ['YouTubeKit/Resources/*.js', 'YouTubeKit/Resources/*LICENSE', 'YouTubeKit/LICENSE'] }
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
