# frozen_string_literal: true

# Splat00n.ink: the per-background "Splatter Custom" skins were merged into two
# skins (default font / custom font). The background is now picked through the
# theme colour setting instead.
class MigrateSplatterCustomSkins < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  # Dummy classes, to make migration possible across version changes
  class Setting < ApplicationRecord; end
  class User < ApplicationRecord; end

  DEFAULT_FONT_SKIN = 'splatfest-default'
  CUSTOM_FONT_SKIN = 'splatter-default'

  BACKGROUNDS = %w(alterna frostyfest raiders splatoween springfest summernights).freeze

  # old skin => [new skin, background (theme colour)]
  SKIN_MAPPING = {
    DEFAULT_FONT_SKIN => [DEFAULT_FONT_SKIN, 'splatoon'],
    CUSTOM_FONT_SKIN => [CUSTOM_FONT_SKIN, 'splatoon'],
  }.merge(
    BACKGROUNDS.to_h { |background| ["#{background}-default", [DEFAULT_FONT_SKIN, background]] },
    BACKGROUNDS.to_h { |background| ["#{background}2-default", [CUSTOM_FONT_SKIN, background]] }
  ).freeze

  def up
    migrate_users
    migrate_site_settings
  end

  def down; end

  private

  def migrate_users
    User.where.not(settings: nil).where('settings LIKE ?', '%-default%').find_each do |user|
      settings = JSON.parse(user.attributes_before_type_cast['settings'])
      next if settings.nil?

      new_skin, background = SKIN_MAPPING[settings['skin']]
      next if new_skin.nil?

      # Keep an already valid background choice for users of the base skins
      next if new_skin == settings['skin'] && SKIN_MAPPING.values.any? { |(_, bg)| bg == settings['web.theme_color'] }

      settings['skin'] = new_skin
      settings['web.theme_color'] = background

      user.update_column('settings', JSON.generate(settings))
    end
  end

  def migrate_site_settings
    Setting.reset_column_information

    skin = setting_value('skin')
    new_skin, background = SKIN_MAPPING[skin]
    return if new_skin.nil? || new_skin == skin

    write_setting('skin', new_skin)
    write_setting('theme_color', background)
  end

  def setting_value(var)
    setting = Setting.find_by(var: var)
    return if setting.blank? || setting.attributes['value'].blank?

    YAML.safe_load(setting.attributes['value'], permitted_classes: [ActiveSupport::HashWithIndifferentAccess, Symbol])
  end

  def write_setting(var, value)
    setting = Setting.find_or_initialize_by(var: var)
    setting.update!(value: value.to_yaml)
  end
end
