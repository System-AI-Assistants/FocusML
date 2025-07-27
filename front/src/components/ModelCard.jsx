function ModelCard({ model }) {

    return <div className="model-card">
        <h2 className="model-name">
            <img src={model.icon} alt="icon" width="22" height="22" style={{ verticalAlign: 'middle' }}/> {model.name}
        </h2>

        <p className="model-description">
            {model.description}
        </p>

        <div className="model-tags">
            {model.tags}
        </div>

        


    </div>

}

export default ModelCard