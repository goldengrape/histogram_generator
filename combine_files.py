def create_single_html_file():
    html_file_path = r'c:\Users\golde\code\histogram_generator\index.html'
    css_file_path = r'c:\Users\golde\code\histogram_generator\style.css'
    js_file_path = r'c:\Users\golde\code\histogram_generator\script.js'
    output_file_path = r'c:\Users\golde\code\histogram_generator\plot_generator.html'

    try:
        # Read HTML content
        with open(html_file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()

        # Read CSS content
        with open(css_file_path, 'r', encoding='utf-8') as f:
            css_content = f.read()

        # Read JavaScript content
        with open(js_file_path, 'r', encoding='utf-8') as f:
            js_content = f.read()

        # Replace CSS link with inline style
        # Assuming the link is <link rel="stylesheet" href="style.css">
        html_content = html_content.replace('<link rel="stylesheet" href="style.css">',
                                            f'<style>\n{css_content}\n</style>')

        # Replace JS script tag with inline script
        # Assuming the script tag is <script src="script.js"></script>
        # and it's at the end of the body
        html_content = html_content.replace('<script src="script.js"></script>',
                                            f'<script>\n{js_content}\n</script>')

        # Write the combined content to the output file
        with open(output_file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"Successfully created '{output_file_path}'")

    except FileNotFoundError as e:
        print(f"Error: {e}. Please ensure all input files exist at the specified paths.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == '__main__':
    create_single_html_file()