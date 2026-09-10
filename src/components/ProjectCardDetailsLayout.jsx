/** Keep project details and their compact action pills on one flexible row. */
const ProjectCardDetailsLayout = ({ children, pills }) => (
    <div
        data-testid="project-card-details"
        className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2"
    >
        <div data-testid="project-card-detail-text" className="min-w-0 flex-1 basis-40">
            {children}
        </div>

        {pills && (
            <div
                data-testid="project-card-pills"
                className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2"
            >
                {pills}
            </div>
        )}
    </div>
);

export default ProjectCardDetailsLayout;
