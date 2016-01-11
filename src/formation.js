/*global Hogan*/
/*exported Formation*/

var Formation = function(u_options) {
    var options = {
            'string_function':false,
            'template_engine':Hogan,
            'template_file':'assets/templates/templates.json',
            'ready_callbacks':[]
        },
        templates = {},
        self = this,
        qs = (pbcutils? pbcutils.query_string_to_object() : false);
    self.ready = false;
    jQuery.extend(options, u_options);

    jQuery.getJSON(options.template_file, function(response) {
        templates = response;
        templates.uncompiled = {};
        for(var theme in templates.templates) {
            templates.uncompiled[theme] = {}
            for(var template_name in templates.templates[theme]) {
                var template = templates.templates[theme][template_name];
                templates.uncompiled[theme]['tmpl_'+template_name] = template;

                templates.templates[theme][template_name] =
                    options.template_engine.compile(template);
            }
        }

        self.templates = templates.templates;
        if(!options.theme)
            options.theme = templates.theme || 'bootstrap';

        self.ready = true;

        for(var callback_idx = 0; callback_idx < options.ready_callbacks.length;
            callback_idx++) {
            var callback = options.ready_callbacks[callback_idx];
            callback();
        }

    });

    var log_warn = function(message) {
        console.warn('FormationWarning: ' + message);
    };

    var FormationException = function(message) {
        this.message = message;

        this.toString = function() {
            return 'FormationException: ' + this.message;
        };
    };

    var check_theme = function(theme) {
        return typeof templates.templates[theme] !== 'undefined';
    };

    var check_template = function(theme, template) {
        return typeof templates.templates[theme] !== 'undefined' &&
               typeof templates.templates[theme][template] !== 'undefined';
    };

    var create_validated_nodes = function(html) {
        var $nodes = $(html);

        var validate_node = function() {
            var $modal = $(this).parents('.modal');
            $(this).parents('.form-group,label').toggleClass('fn-dirty', true);

            if($(this).attr('required')) {
                if(!$(this).val()) {
                    $(this).parents('.form-group,label')
                           .toggleClass('fn-valid',false)
                           .toggleClass('fn-invalid',true);
                } else if(!$(this).attr('pattern')) {
                    $(this).parents('.form-group,label')
                           .toggleClass('fn-valid',true)
                           .toggleClass('fn-invalid',false);
                }
            }

            if($modal.length > 0) {
                var allow = true;
                $modal.find('[required], [pattern]').each(function(){
                    if($(this).parents('.fn-valid').length === 0)
                        allow = false;
                });

                $modal.find('.modal-footer .btn-primary')
                      .prop('disabled', !allow);
            }
        };

        $nodes.on('keyup', '.live-validate input, .live-validate textarea', validate_node);
        $nodes.on('change', 'input, select, textarea', validate_node);

        return $nodes;
    };

    var extract_data_from_form = function($body, lookup, unvalidated) {
        if(!lookup)
            var lookup = {};
        var $dirty = $body.find('.fn-dirty');
        if(unvalidated)
            $dirty = $body;
        var data = {};

        $dirty.find('input, select, radio:checked, textarea').each(function(){
            if($(this).attr('name')) {
                var key = $(this).attr('name');
                if(key in lookup)
                    key = lookup[key];
                data[key] = $(this).val();
                if($(this).attr('type') && $(this).attr('type') === 'checkbox')
                    data[key] = $(this).prop('checked');
            };
        });
        if(!unvalidated) {
            $body.find(':not(.fn-dirty)').find('select, radio:checked').each(function(){
                if($(this).attr('name')) {
                    var key = $(this).attr('name');
                    if(key in lookup)
                        key = lookup[key];
                    data[key] = $(this).val();
                };
            });
        }

        return data;
    }

    var render_fields = function(fields, values, theme) {
        if(!values) values = {};
        if(!theme) theme = options.theme;
        var fields_html = '',
            field,
            this_template,
            secondary_counter = 0;
        for(var field_idx = 0; field_idx < fields.length; field_idx++) {
            field = jQuery.extend({}, fields[field_idx]);
            if(!field.type) {
                log_warn('All fields require a "type" value.');
                continue;
            }

            if (field.repeat && secondary_counter < field.repeat) {
                field_idx--;
                secondary_counter++;

                for(var attr_name in field) {
                    if (typeof field[attr_name] === 'string')
                        field[attr_name] = field[attr_name].replace(/%n/g, secondary_counter);
                }
            } else if (field.repeat && secondary_counter == field.repeat) {
                secondary_counter = 0;
                continue;
            }

            if (qs && field.name && qs[field.name] && qs[field.name] !== 'null') {
                field.value = qs[field.name];
                field.current_value = field.value;
            }

            this_template = templates.templates[theme][field.type];

            if(!this_template) {
                log_warn('No template present for Theme "' + theme +
                    '" and field type "' + field.type + '".');
                continue;
            }

            if(field.name && field.name in values) {
                $.extend(field, values[field.name]);
            }

            if(field.type === 'selectbox' && field.current_value) {
                for(var opt_idx = 0; opt_idx < field.options.length;
                    opt_idx++) {
                    var option = field.options[opt_idx];
                    if(option.value === field.current_value)
                        option.selected = true;
                    else
                        option.selected = false;
                }
            }

            if(field.type === 'div')
                field.content = render_fields(field.contents, values, theme);

            if(['checkbox','radio','image','label']
                .indexOf(field.type) === -1 && field.label)
                fields_html += templates.templates[theme].label.render(field);
            fields_html += this_template.render(field);
        }

        return fields_html;
    };

    var create_form = function(form, values, theme, html) {
        if(!values) values = {};
        if(!theme) theme = options.theme;
        if(!html) html = false;
        if(!check_theme(theme)) {
            log_warn('Specified theme "' + theme +
                '" not found. Reverting to Bootstrap.');
            theme = 'bootstrap';
        }

        if(typeof templates.forms[form] === 'undefined')
            throw new FormationException('Form with identifier "' + form +
                '" was not found.');

        var form_html = '',
            form_array = templates.forms[form];

        form_html = render_fields(form_array, values, theme);

        if(html)
            return form_html;
        else
            return create_validated_nodes(form_html);
    };

    var create_modal = function(modal, form, values, theme, html) {
        values = values || {};
        theme = theme || options.theme;
        html = html || false;

        var modal_html = '',
            form_html = (form)? create_form(form, values, theme, true) : '';

        if(!check_template(theme, 'modal')) {
            log_warn('No modal template present for Theme "' + theme +
                '". Reverting to Bootstrap.');
            theme = 'bootstrap';
        }

        if(typeof templates.modals[modal] === 'undefined')
            throw new FormationException('Modal with identifier "' + modal +
                '" was not found.');

        modal = jQuery.extend({}, templates.modals[modal]);

        var this_template = templates.templates[theme].modal;
        modal.body = form_html;
        modal_html = this_template.render(modal);

        if(html)
            return modal_html;
        else
            return create_validated_nodes(modal_html);
    };

    var render_template = function(template, values, theme) {
        values = values || {};
        theme = theme || options.theme;

        if(!check_template(theme, template))
            throw new FormationException('Template with theme "' + theme +
                '" and ID "' + template + '" was not found.');

        var this_template = templates.templates[theme][template];

        return this_template.render(
            values,
            templates.uncompiled[theme]
        );
    };

    self.form = create_form;
    self.modal = create_modal;
    self.template = render_template;
    self.extract = extract_data_from_form;
};
